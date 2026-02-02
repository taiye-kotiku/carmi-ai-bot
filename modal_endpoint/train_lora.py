import modal
import os

app = modal.App("lora-training")

image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("git", "libgl1-mesa-glx", "libglib2.0-0", "wget")
    .pip_install(
        "numpy<2",
        "torch==2.1.2",
        "torchvision==0.16.2",
        "diffusers==0.25.1",
        "transformers==4.36.2",
        "accelerate==0.25.0",
        "safetensors==0.4.1",
        "huggingface_hub==0.20.3",
        "Pillow==10.1.0",
        "requests",
        "peft==0.7.1",
    )
)

@app.function(
    image=image,
    gpu="A10G",
    timeout=3600,
    secrets=[modal.Secret.from_name("huggingface-secret")],
)
def train_lora(
    character_id: str,
    character_name: str,
    image_urls: list[str],
    webhook_url: str,
    supabase_url: str,
    supabase_key: str,
):
    import torch
    import requests
    from pathlib import Path
    from PIL import Image
    from io import BytesIO
    import json
    
    print(f"🚀 Starting training for: {character_name}")
    print(f"   Character ID: {character_id}")
    print(f"   Images: {len(image_urls)}")
    
    work_dir = Path("/tmp/training")
    work_dir.mkdir(exist_ok=True)
    images_dir = work_dir / "images"
    images_dir.mkdir(exist_ok=True)
    output_dir = work_dir / "output"
    output_dir.mkdir(exist_ok=True)
    
    trigger_word = f"photo of {character_name.lower().replace(' ', '_')}_person"
    
    try:
        # Download images
        print("\n📥 Downloading images...")
        for i, url in enumerate(image_urls):
            response = requests.get(url, timeout=30)
            img = Image.open(BytesIO(response.content)).convert("RGB")
            img = img.resize((1024, 1024), Image.Resampling.LANCZOS)
            img.save(images_dir / f"image_{i:03d}.png")
            print(f"   ✓ Image {i+1}/{len(image_urls)}")
        
        # Load model
        print("\n🔧 Loading SDXL model...")
        from diffusers import StableDiffusionXLPipeline
        
        pipe = StableDiffusionXLPipeline.from_pretrained(
            "stabilityai/stable-diffusion-xl-base-1.0",
            torch_dtype=torch.float16,
            use_safetensors=True,
            variant="fp16",
        )
        pipe = pipe.to("cuda")
        
        # Setup LoRA
        from peft import LoraConfig, get_peft_model
        
        lora_config = LoraConfig(
            r=16,
            lora_alpha=16,
            target_modules=["to_q", "to_v", "to_k", "to_out.0"],
            lora_dropout=0.0,
        )
        
        unet = pipe.unet
        unet.requires_grad_(False)
        unet = get_peft_model(unet, lora_config)
        unet.print_trainable_parameters()
        
        # Prepare training data
        from torchvision import transforms
        
        transform = transforms.Compose([
            transforms.Resize((1024, 1024)),
            transforms.ToTensor(),
            transforms.Normalize([0.5, 0.5, 0.5], [0.5, 0.5, 0.5]),
        ])
        
        training_images = []
        for img_path in sorted(images_dir.glob("*.png")):
            img = Image.open(img_path).convert("RGB")
            training_images.append(transform(img))
        
        training_tensor = torch.stack(training_images).to("cuda", dtype=torch.float32)
        
        # Get text embeddings once
        tokenizer = pipe.tokenizer
        tokenizer_2 = pipe.tokenizer_2
        text_encoder = pipe.text_encoder
        text_encoder_2 = pipe.text_encoder_2
        
        text_input = tokenizer(
            trigger_word,
            padding="max_length",
            max_length=77,
            truncation=True,
            return_tensors="pt"
        ).to("cuda")
        
        text_input_2 = tokenizer_2(
            trigger_word,
            padding="max_length",
            max_length=77,
            truncation=True,
            return_tensors="pt"
        ).to("cuda")
        
        with torch.no_grad():
            prompt_embeds = text_encoder(text_input.input_ids)[0]
            pooled_prompt_embeds = text_encoder_2(text_input_2.input_ids, output_hidden_states=True)
            prompt_embeds_2 = pooled_prompt_embeds.hidden_states[-2]
            pooled_prompt_embeds = pooled_prompt_embeds[0]
        
        prompt_embeds = torch.cat([prompt_embeds, prompt_embeds_2], dim=-1).to(dtype=torch.float16)
        
        # Training
        print(f"\n🔧 Training LoRA (500 steps)...")
        
        optimizer = torch.optim.AdamW(
            filter(lambda p: p.requires_grad, unet.parameters()),
            lr=1e-4,
            weight_decay=0.01
        )
        
        scheduler = pipe.scheduler
        vae = pipe.vae
        
        unet.train()
        
        for step in range(500):
            optimizer.zero_grad()
            
            # Get random image
            idx = step % len(training_images)
            pixel_values = training_tensor[idx:idx+1].to(dtype=torch.float16)
            
            # Encode to latent space
            with torch.no_grad():
                latents = vae.encode(pixel_values).latent_dist.sample()
                latents = latents * vae.config.scaling_factor
            
            # Sample noise and timestep
            noise = torch.randn_like(latents)
            timesteps = torch.randint(0, scheduler.config.num_train_timesteps, (1,), device="cuda").long()
            
            # Add noise
            noisy_latents = scheduler.add_noise(latents, noise, timesteps)
            
            # Time embeddings for SDXL
            add_time_ids = torch.tensor([[1024, 1024, 0, 0, 1024, 1024]], device="cuda", dtype=torch.float16)
            added_cond_kwargs = {
                "text_embeds": pooled_prompt_embeds.to(dtype=torch.float16),
                "time_ids": add_time_ids
            }
            
            # Predict noise
            with torch.autocast("cuda", dtype=torch.float16):
                noise_pred = unet(
                    noisy_latents,
                    timesteps,
                    encoder_hidden_states=prompt_embeds,
                    added_cond_kwargs=added_cond_kwargs,
                    return_dict=False,
                )[0]
            
            # Calculate loss
            loss = torch.nn.functional.mse_loss(noise_pred.float(), noise.float())
            
            # Skip if nan
            if torch.isnan(loss):
                print(f"   Warning: NaN loss at step {step}, skipping...")
                continue
            
            loss.backward()
            
            # Gradient clipping
            torch.nn.utils.clip_grad_norm_(unet.parameters(), 1.0)
            
            optimizer.step()
            
            if step % 100 == 0:
                print(f"   Step {step}/500, Loss: {loss.item():.4f}")
        
        # Save LoRA
        print("\n💾 Saving LoRA weights...")
        lora_state_dict = {}
        for name, param in unet.named_parameters():
            if "lora" in name.lower() and param.requires_grad:
                lora_state_dict[name] = param.cpu()
        
        from safetensors.torch import save_file
        lora_path = output_dir / "lora.safetensors"
        save_file(lora_state_dict, str(lora_path))
        
        # Upload to Supabase via REST API
        print("\n☁️ Uploading to Supabase Storage...")
        
        with open(lora_path, "rb") as f:
            lora_bytes = f.read()
        
        upload_url = f"{supabase_url}/storage/v1/object/loras/{character_id}/lora.safetensors"
        headers = {
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/octet-stream",
            "x-upsert": "true"
        }
        
        upload_response = requests.post(upload_url, headers=headers, data=lora_bytes, timeout=120)
        
        if upload_response.status_code not in [200, 201]:
            raise Exception(f"Upload failed: {upload_response.text}")
        
        model_url = f"{supabase_url}/storage/v1/object/public/loras/{character_id}/lora.safetensors"
        
        print(f"\n✅ Training complete!")
        print(f"   Model URL: {model_url}")
        print(f"   Trigger: {trigger_word}")
        
        # Success webhook
        requests.post(webhook_url, json={
            "character_id": character_id,
            "status": "ready",
            "model_url": model_url,
            "trigger_word": trigger_word,
        }, timeout=30)
        
        return {"success": True, "model_url": model_url, "trigger_word": trigger_word}
        
    except Exception as e:
        print(f"\n❌ Training failed: {str(e)}")
        import traceback
        traceback.print_exc()
        
        requests.post(webhook_url, json={
            "character_id": character_id,
            "status": "failed",
            "error": str(e),
        }, timeout=30)
        
        return {"success": False, "error": str(e)}


@app.function(image=image)
@modal.web_endpoint(method="POST")
def start_training(request: dict):
    character_id = request.get("character_id")
    character_name = request.get("character_name")
    image_urls = request.get("reference_image_urls", [])
    webhook_url = request.get("webhook_url")
    supabase_url = request.get("supabase_url")
    supabase_key = request.get("supabase_service_key")
    
    if not all([character_id, character_name, image_urls, webhook_url]):
        return {"error": "Missing required fields"}
    
    train_lora.spawn(
        character_id=character_id,
        character_name=character_name,
        image_urls=image_urls,
        webhook_url=webhook_url,
        supabase_url=supabase_url or "",
        supabase_key=supabase_key or "",
    )
    
    return {"success": True, "message": "Training started"}