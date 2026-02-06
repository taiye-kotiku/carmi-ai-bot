"""
Modal FLUX.1-dev LoRA training endpoint.
Trains a LoRA on FLUX.1-dev using diffusers train_dreambooth_lora_flux.
Output: safetensors uploaded to Supabase, webhook called.
"""

import modal
import os

app = modal.App("carmi-flux-lora-training")

# FLUX training needs A100 80GB for comfortable training
image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("git", "libgl1-mesa-glx", "libglib2.0-0")
    .pip_install(
        "torch>=2.0.0",
        "torchvision",
        "accelerate>=0.31.0",
        "transformers>=4.41.2",
        "diffusers @ git+https://github.com/huggingface/diffusers.git",
        "peft>=0.11.1",
        "safetensors",
        "Pillow",
        "requests",
        "ftfy",
        "Jinja2",
        "sentencepiece",
        "datasets",
        "bitsandbytes",
        "prodigyopt",
        "huggingface_hub",
    )
)


@app.function(
    image=image,
    gpu="A100",
    timeout=7200,  # 2 hours for FLUX training
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
    import subprocess
    import requests
    from pathlib import Path
    from PIL import Image
    from io import BytesIO

    print(f"🚀 FLUX LoRA training for: {character_name}")
    print(f"   Character ID: {character_id}")
    print(f"   Images: {len(image_urls)}")

    work_dir = Path("/tmp/flux_training")
    work_dir.mkdir(exist_ok=True)
    images_dir = work_dir / "instance_images"
    images_dir.mkdir(exist_ok=True)
    output_dir = work_dir / "output"
    output_dir.mkdir(exist_ok=True)

    # Trigger word for Fal.ai - use format compatible with FLUX
    trigger_word = f"ohwx {character_name.lower().replace(' ', '')} person"
    instance_prompt = f"a photo of {trigger_word}"

    try:
        # Download images (512 or 1024 - FLUX prefers 1024 but 512 saves memory)
        resolution = 512
        print("\n📥 Downloading images...")
        for i, url in enumerate(image_urls[:30]):  # Cap at 30
            try:
                response = requests.get(url, timeout=30)
                response.raise_for_status()
                img = Image.open(BytesIO(response.content)).convert("RGB")
                img = img.resize((resolution, resolution), Image.Resampling.LANCZOS)
                img.save(images_dir / f"image_{i:03d}.png")
                print(f"   ✓ Image {i+1}/{min(len(image_urls), 30)}")
            except Exception as e:
                print(f"   ⚠️ Skip image {i+1}: {e}")

        image_count = len(list(images_dir.glob("*.png")))
        if image_count < 5:
            raise ValueError(f"Need at least 5 valid images, got {image_count}")

        # Fetch and run diffusers FLUX LoRA training script
        script_url = "https://raw.githubusercontent.com/huggingface/diffusers/main/examples/dreambooth/train_dreambooth_lora_flux.py"
        script_path = work_dir / "train_dreambooth_lora_flux.py"
        script_content = requests.get(script_url, timeout=60).text
        script_path.write_text(script_content)

        cmd = [
            "accelerate", "launch",
            "--mixed_precision", "fp16",
            str(script_path),
            "--pretrained_model_name_or_path", "black-forest-labs/FLUX.1-dev",
            "--instance_data_dir", str(images_dir),
            "--instance_prompt", instance_prompt,
            "--output_dir", str(output_dir),
            "--resolution", str(resolution),
            "--train_batch_size", "2",
            "--gradient_accumulation_steps", "2",
            "--max_train_steps", "500",
            "--learning_rate", "1e-4",
            "--gradient_checkpointing",
            "--checkpointing_steps", "250",
            "--checkpoints_total_limit", "1",
            "--rank", "8",
            "--lora_alpha", "16",
        ]

        print("\n🔧 Starting FLUX LoRA training...")
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(work_dir))
        print(result.stdout[-4000:] if len(result.stdout) > 4000 else result.stdout)
        if result.returncode != 0:
            print("STDERR:", result.stderr[-2000:] if len(result.stderr) > 2000 else result.stderr)
            raise RuntimeError(f"Training failed with exit code {result.returncode}")

        # Find output safetensors
        lora_file = output_dir / "pytorch_lora_weights.safetensors"
        if not lora_file.exists():
            # Try alternative name
            candidates = list(output_dir.glob("*.safetensors"))
            if not candidates:
                raise FileNotFoundError("No safetensors output found")
            lora_file = candidates[0]

        # Upload to Supabase Storage
        model_url = ""
        if supabase_url and supabase_key:
            print("\n☁️ Uploading to Supabase Storage...")
            with open(lora_file, "rb") as f:
                lora_bytes = f.read()

            # Supabase storage: POST /storage/v1/object/{bucket}/{path}
            upload_path = f"loras/{character_id}/lora.safetensors"
            upload_url = f"{supabase_url.rstrip('/')}/storage/v1/object/loras/{character_id}/lora.safetensors"
            headers = {
                "Authorization": f"Bearer {supabase_key}",
                "Content-Type": "application/octet-stream",
                "x-upsert": "true",
            }
            resp = requests.post(upload_url, headers=headers, data=lora_bytes, timeout=120)
            if resp.status_code in (200, 201):
                model_url = f"{supabase_url.rstrip('/')}/storage/v1/object/public/loras/{character_id}/lora.safetensors"
                print(f"   ✓ Uploaded to {model_url}")
            else:
                print(f"   ⚠️ Upload failed: {resp.status_code} - {resp.text}")

        if not model_url:
            raise ValueError("Failed to upload LoRA to Supabase")

        print("\n✅ Training complete!")
        print(f"   Trigger word: {trigger_word}")

        requests.post(
            webhook_url,
            json={
                "character_id": character_id,
                "status": "ready",
                "model_url": model_url,
                "trigger_word": trigger_word,
            },
            timeout=30,
        )
        return {"success": True, "model_url": model_url, "trigger_word": trigger_word}

    except Exception as e:
        print(f"\n❌ Training failed: {e}")
        import traceback
        traceback.print_exc()
        requests.post(
            webhook_url,
            json={
                "character_id": character_id,
                "status": "failed",
                "error": str(e),
            },
            timeout=30,
        )
        return {"success": False, "error": str(e)}


@app.function(image=image)
@modal.fastapi_endpoint(method="POST")
def start_training(request: dict):
    character_id = request.get("character_id")
    character_name = request.get("character_name")
    image_urls = request.get("reference_image_urls", request.get("image_urls", []))
    webhook_url = request.get("webhook_url")
    supabase_url = request.get("supabase_url", os.environ.get("SUPABASE_URL", ""))
    supabase_key = request.get("supabase_service_key", os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""))

    if not all([character_id, character_name, image_urls, webhook_url]):
        return {"error": "Missing required fields: character_id, character_name, reference_image_urls, webhook_url"}

    train_lora.spawn(
        character_id=character_id,
        character_name=character_name,
        image_urls=image_urls,
        webhook_url=webhook_url,
        supabase_url=supabase_url,
        supabase_key=supabase_key,
    )
    return {"success": True, "message": "FLUX LoRA training started"}
