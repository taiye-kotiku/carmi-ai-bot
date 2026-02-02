import modal
import os
import requests
import shutil
from pathlib import Path

app = modal.App("character-lora-trainer")

image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("git", "wget", "libgl1-mesa-glx", "libglib2.0-0")
    .pip_install(
        "numpy<2",
        "fastapi",
        "uvicorn",
        "torch==2.1.2",
        "torchvision==0.16.2", 
        "diffusers==0.25.0",
        "transformers==4.36.2",
        "huggingface_hub==0.20.3",
        "accelerate==0.25.0",
        "safetensors==0.4.1",
        "peft==0.7.1",
        "Pillow==10.1.0",
        "requests==2.31.0",
        "supabase==2.3.4",
    )
)

volume = modal.Volume.from_name("sdxl-cache", create_if_missing=True)


@app.function(
    image=image,
    gpu="A10G",
    timeout=3600,
    volumes={"/cache": volume},
    secrets=[modal.Secret.from_name("supabase-credentials")],
)
def train_lora(
    character_id: str,
    character_name: str,
    reference_image_urls: list[str],
    webhook_url: str,
):
    from PIL import Image
    from io import BytesIO
    from supabase import create_client
    import torch
    
    print(f"🚀 Starting training for: {character_name}")
    print(f"   Character ID: {character_id}")
    print(f"   Images: {len(reference_image_urls)}")
    
    supabase_url = os.environ["SUPABASE_URL"]
    supabase_key = os.environ["SUPABASE_SERVICE_KEY"]
    
    work_dir = Path("/tmp/training")
    images_dir = work_dir / "images"
    output_dir = work_dir / "output"
    
    if work_dir.exists():
        shutil.rmtree(work_dir)
    
    work_dir.mkdir(parents=True)
    images_dir.mkdir()
    output_dir.mkdir()
    
    trigger_word = f"ohwx{character_id[:6]}"
    
    try:
        # Download images
        print("\n📥 Downloading images...")
        downloaded = 0
        for i, url in enumerate(reference_image_urls):
            try:
                resp = requests.get(url, timeout=60)
                resp.raise_for_status()
                img = Image.open(BytesIO(resp.content)).convert("RGB")
                img = img.resize((512, 512), Image.Resampling.LANCZOS)
                img.save(images_dir / f"img_{i:02d}.png")
                
                caption_path = images_dir / f"img_{i:02d}.txt"
                caption_path.write_text(f"photo of {trigger_word} person")
                
                downloaded += 1
                print(f"   ✓ Image {i+1}/{len(reference_image_urls)}")
            except Exception as e:
                print(f"   ✗ Failed image {i}: {e}")
        
        if downloaded < 3:
            raise ValueError(f"Only {downloaded} images downloaded, need at least 3")
        
        # Train LoRA
        print("\n🔧 Loading SDXL model...")
        from diffusers import StableDiffusionXLPipeline
        from peft import LoraConfig, get_peft_model
        
        pipe = StableDiffusionXLPipeline.from_pretrained(
            "stabilityai/stable-diffusion-xl-base-1.0",
            torch_dtype=torch.float16,
            variant="fp16",
            cache_dir="/cache",
        ).to("cuda")
        
        lora_config = LoraConfig(
            r=32,
            lora_alpha=32,
            target_modules=["to_k", "to_q", "to_v", "to_out.0"],
            lora_dropout=0.0,
        )
        
        pipe.unet = get_peft_model(pipe.unet, lora_config)
        
        print("\n🔧 Training LoRA (500 steps)...")
        optimizer = torch.optim.AdamW(pipe.unet.parameters(), lr=1e-4)
        
        image_files = list(images_dir.glob("*.png"))
        
        for step in range(500):
            img_path = image_files[step % len(image_files)]
            img = Image.open(img_path).convert("RGB")
            
            from torchvision import transforms
            transform = transforms.Compose([
                transforms.ToTensor(),
                transforms.Normalize([0.5], [0.5]),
            ])
            img_tensor = transform(img).unsqueeze(0).to("cuda", torch.float16)
            
            latents = pipe.vae.encode(img_tensor).latent_dist.sample()
            latents = latents * pipe.vae.config.scaling_factor
            
            noise = torch.randn_like(latents)
            timesteps = torch.randint(0, 1000, (1,), device="cuda").long()
            noisy_latents = pipe.scheduler.add_noise(latents, noise, timesteps)
            
            caption = f"photo of {trigger_word} person"
            prompt_embeds, _, pooled_embeds, _ = pipe.encode_prompt(caption, "cuda")
            
            add_time_ids = torch.zeros(1, 6, device="cuda", dtype=torch.float16)
            
            noise_pred = pipe.unet(
                noisy_latents,
                timesteps,
                encoder_hidden_states=prompt_embeds,
                added_cond_kwargs={"text_embeds": pooled_embeds, "time_ids": add_time_ids},
            ).sample
            
            loss = torch.nn.functional.mse_loss(noise_pred, noise)
            loss.backward()
            optimizer.step()
            optimizer.zero_grad()
            
            if step % 100 == 0:
                print(f"   Step {step}/500, Loss: {loss.item():.4f}")
        
        # Save LoRA
        print("\n💾 Saving LoRA weights...")
        pipe.unet.save_pretrained(output_dir)
        
        safetensors_files = list(output_dir.glob("**/*.safetensors"))
        if not safetensors_files:
            raise ValueError("No safetensors file generated")
        
        lora_path = safetensors_files[0]
        
        # Upload to Supabase
        print("\n☁️ Uploading to Supabase Storage...")
        supabase = create_client(supabase_url, supabase_key)
        
        destination = f"loras/{character_id}/model.safetensors"
        
        with open(lora_path, "rb") as f:
            file_data = f.read()
        
        supabase.storage.from_("models").upload(
            destination,
            file_data,
            {"content-type": "application/octet-stream", "upsert": "true"}
        )
        
        model_url = supabase.storage.from_("models").get_public_url(destination)
        print(f"   ✓ Uploaded: {model_url}")
        
        # Notify webhook
        print("\n📞 Notifying webhook...")
        requests.post(webhook_url, json={
            "character_id": character_id,
            "status": "ready",
            "model_url": model_url,
            "trigger_word": trigger_word,
        }, timeout=30)
        
        print("\n✅ TRAINING COMPLETE!")
        return {"success": True, "model_url": model_url, "trigger_word": trigger_word}
        
    except Exception as e:
        print(f"\n❌ Training failed: {e}")
        try:
            requests.post(webhook_url, json={
                "character_id": character_id,
                "status": "failed",
                "error": str(e),
            }, timeout=30)
        except:
            pass
        return {"success": False, "error": str(e)}


@app.function(image=image, secrets=[modal.Secret.from_name("supabase-credentials")])
@modal.fastapi_endpoint(method="POST")
def train_endpoint(request: dict):
    required = ["character_id", "character_name", "reference_image_urls", "webhook_url"]
    for field in required:
        if field not in request:
            return {"error": f"Missing: {field}"}
    
    if len(request["reference_image_urls"]) < 3:
        return {"error": "Need at least 3 images"}
    
    train_lora.spawn(
        character_id=request["character_id"],
        character_name=request["character_name"],
        reference_image_urls=request["reference_image_urls"],
        webhook_url=request["webhook_url"],
    )
    
    return {
        "status": "training_started",
        "character_id": request["character_id"],
        "message": "Training started. Will notify webhook when complete."
    }