import modal
import os

app = modal.App("lora-training")

image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("git", "libgl1-mesa-glx", "libglib2.0-0")
    .pip_install(
        "numpy<2",
        "torch==2.1.2",
        "fastapi",
        "uvicorn",
        "torchvision==0.16.2",
        "diffusers==0.25.1",
        "transformers==4.36.2",
        "accelerate==0.25.0",
        "safetensors==0.4.1",
        "huggingface_hub==0.20.3",
        "Pillow==10.1.0",
        "requests",
        "peft==0.7.1",
        "bitsandbytes==0.41.3",
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
    supabase_url: str = "",
    supabase_key: str = "",
):
    import torch
    import requests
    import gc
    from pathlib import Path
    from PIL import Image
    from io import BytesIO
    
    print(f"🚀 Starting training for: {character_name}")
    print(f"   Character ID: {character_id}")
    print(f"   Images: {len(image_urls)}")
    print(f"   GPU: {torch.cuda.get_device_name(0)}")
    print(f"   VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
    
    work_dir = Path("/tmp/training")
    work_dir.mkdir(exist_ok=True)
    images_dir = work_dir / "images"
    images_dir.mkdir(exist_ok=True)
    output_dir = work_dir / "output"
    output_dir.mkdir(exist_ok=True)
    
    trigger_word = f"ohwx {character_name.lower().replace(' ', '')}"
    
    try:
        # Download images at 512x512 to save memory
        print("\n📥 Downloading images...")
        for i, url in enumerate(image_urls):
            response = requests.get(url, timeout=30)
            img = Image.open(BytesIO(response.content)).convert("RGB")
            # Resize to 512x512 for memory efficiency
            img = img.resize((512, 512), Image.Resampling.LANCZOS)
            img.save(images_dir / f"image_{i:03d}.png")
            print(f"   ✓ Image {i+1}/{len(image_urls)}")
        
        # Load SD 1.5 instead of SDXL (much lighter, fits in A10G)
        print("\n🔧 Loading Stable Diffusion model...")
        from diffusers import StableDiffusionPipeline, DDPMScheduler
        
        model_id = "runwayml/stable-diffusion-v1-5"
        
        pipe = StableDiffusionPipeline.from_pretrained(
            model_id,
            torch_dtype=torch.float16,
            safety_checker=None,
        )
        pipe = pipe.to("cuda")
        pipe.enable_attention_slicing()
        
        # Get components
        vae = pipe.vae
        unet = pipe.unet
        text_encoder = pipe.text_encoder
        tokenizer = pipe.tokenizer
        noise_scheduler = DDPMScheduler.from_config(pipe.scheduler.config)
        
        # Setup LoRA on UNet
        from peft import LoraConfig, get_peft_model
        
        lora_config = LoraConfig(
            r=8,
            lora_alpha=16,
            target_modules=["to_q", "to_v", "to_k", "to_out.0"],
            lora_dropout=0.05,
        )
        
        unet.requires_grad_(False)
        unet = get_peft_model(unet, lora_config)
        unet.print_trainable_parameters()
        
        # Freeze VAE and text encoder
        vae.requires_grad_(False)
        text_encoder.requires_grad_(False)
        
        # Prepare training data
        from torchvision import transforms
        
        transform = transforms.Compose([
            transforms.Resize((512, 512)),
            transforms.ToTensor(),
            transforms.Normalize([0.5], [0.5]),
        ])
        
        # Load and encode images once
        print("\n🖼️ Encoding training images...")
        latents_list = []
        
        for img_path in sorted(images_dir.glob("*.png")):
            img = Image.open(img_path).convert("RGB")
            img_tensor = transform(img).unsqueeze(0).to("cuda", dtype=torch.float16)
            
            with torch.no_grad():
                latent = vae.encode(img_tensor).latent_dist.sample()
                latent = latent * vae.config.scaling_factor
                latents_list.append(latent)
        
        training_latents = torch.cat(latents_list, dim=0)
        print(f"   ✓ Encoded {len(latents_list)} images to latent space")
        
        # Clear some memory
        del latents_list
        gc.collect()
        torch.cuda.empty_cache()
        
        # Get text embeddings
        print("\n📝 Encoding trigger word...")
        text_input = tokenizer(
            trigger_word,
            padding="max_length",
            max_length=77,
            truncation=True,
            return_tensors="pt"
        ).to("cuda")
        
        with torch.no_grad():
            text_embeddings = text_encoder(text_input.input_ids)[0]
        
        # Training setup
        optimizer = torch.optim.AdamW(
            filter(lambda p: p.requires_grad, unet.parameters()),
            lr=1e-4,
            weight_decay=0.01
        )
        
        num_steps = 500
        unet.train()
        
        print(f"\n🔧 Training LoRA ({num_steps} steps)...")
        
        for step in range(num_steps):
            optimizer.zero_grad()
            
            # Get random training latent
            idx = step % len(training_latents)
            latents = training_latents[idx:idx+1]
            
            # Sample noise
            noise = torch.randn_like(latents)
            
            # Sample timestep
            timesteps = torch.randint(
                0, noise_scheduler.config.num_train_timesteps, 
                (1,), device="cuda"
            ).long()
            
            # Add noise to latents
            noisy_latents = noise_scheduler.add_noise(latents, noise, timesteps)
            
            # Predict noise
            noise_pred = unet(
                noisy_latents,
                timesteps,
                encoder_hidden_states=text_embeddings,
            ).sample
            
            # MSE loss
            loss = torch.nn.functional.mse_loss(noise_pred, noise)
            
            if torch.isnan(loss) or torch.isinf(loss):
                print(f"   ⚠️ Invalid loss at step {step}, skipping...")
                continue
            
            loss.backward()
            torch.nn.utils.clip_grad_norm_(unet.parameters(), 1.0)
            optimizer.step()
            
            if step % 50 == 0:
                print(f"   Step {step}/{num_steps}, Loss: {loss.item():.4f}")
        
        # Save LoRA weights
        print("\n💾 Saving LoRA weights...")
        
        lora_state_dict = {}
        for name, param in unet.named_parameters():
            if param.requires_grad:
                # Clean up the name for compatibility
                clean_name = name.replace("base_model.model.", "")
                lora_state_dict[clean_name] = param.detach().cpu()
        
        from safetensors.torch import save_file
        lora_path = output_dir / "lora.safetensors"
        save_file(lora_state_dict, str(lora_path))
        
        print(f"   ✓ Saved {len(lora_state_dict)} tensors")
        
        # Upload to Supabase
        model_url = ""
        if supabase_url and supabase_key:
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
            
            if upload_response.status_code in [200, 201]:
                model_url = f"{supabase_url}/storage/v1/object/public/loras/{character_id}/lora.safetensors"
                print(f"   ✓ Uploaded to {model_url}")
            else:
                print(f"   ⚠️ Upload failed: {upload_response.status_code} - {upload_response.text}")
        
        print(f"\n✅ Training complete!")
        print(f"   Trigger word: {trigger_word}")
        
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
@modal.fastapi_endpoint(method="POST")
def start_training(request: dict):
    character_id = request.get("character_id")
    character_name = request.get("character_name")
    image_urls = request.get("reference_image_urls", [])
    webhook_url = request.get("webhook_url")
    supabase_url = request.get("supabase_url", "")
    supabase_key = request.get("supabase_service_key", "")
    
    if not all([character_id, character_name, image_urls, webhook_url]):
        return {"error": "Missing required fields"}
    
    train_lora.spawn(
        character_id=character_id,
        character_name=character_name,
        image_urls=image_urls,
        webhook_url=webhook_url,
        supabase_url=supabase_url,
        supabase_key=supabase_key,
    )
    
    return {"success": True, "message": "Training started"}