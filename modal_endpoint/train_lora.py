# modal_training/train_flux_lora.py
"""
Modal FLUX.1-dev LoRA training endpoint.
Trains a LoRA on FLUX.1-dev using diffusers train_dreambooth_lora_flux.
Output: safetensors uploaded to Supabase, webhook called on completion.
"""

import modal
import os

app = modal.App("carmi-flux-lora-training")

# Build image with all training dependencies
training_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "libgl1-mesa-glx", "libglib2.0-0", "wget")
    .pip_install(
        "torch==2.3.1",
        "torchvision==0.18.1",
        "accelerate>=0.31.0",
        "fastapi",
        "uvicorn",
        "transformers>=4.43.0",
        "diffusers[torch] @ git+https://github.com/huggingface/diffusers.git",
        "peft>=0.12.0",
        "safetensors",
        "Pillow>=10.0.0",
        "requests",
        "ftfy",
        "sentencepiece",
        "protobuf",
        "datasets",
        "bitsandbytes",
        "prodigyopt",
        "huggingface_hub>=0.23.0",
        "wandb",  # optional, for logging
    )
    .run_commands(
        # Pre-initialize accelerate config so training doesn't hang waiting for input
        "mkdir -p /root/.cache/huggingface/accelerate",
        'echo \'{"compute_environment": "LOCAL_MACHINE", "debug": false, "distributed_type": "NO", "downcast_bf16": "no", "enable_cpu_affinity": false, "gpu_ids": "0", "machine_rank": 0, "main_training_function": "main", "mixed_precision": "bf16", "num_machines": 1, "num_processes": 1, "rdzv_backend": "static", "same_network": true, "tpu_env": [], "tpu_use_cluster": false, "tpu_use_sudo": false, "use_cpu": false}\' > /root/.cache/huggingface/accelerate/default_config.yaml',
    )
)

# Volume to cache the FLUX model weights across runs (saves ~30 min download each time)
model_cache = modal.Volume.from_name("flux-model-cache", create_if_missing=True)

FLUX_MODEL_ID = "black-forest-labs/FLUX.1-dev"
CACHE_DIR = "/root/.cache/huggingface/hub"


@app.function(
    image=training_image,
    gpu="A100-80GB",  # FLUX needs 80GB VRAM for comfortable training
    timeout=7200,  # 2 hours max
    secrets=[
        modal.Secret.from_name("huggingface-secret"),   # HF_TOKEN
        modal.Secret.from_name("supabase-credentials"),       # SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
    ],
    volumes={CACHE_DIR: model_cache},
    retries=0,  # Don't retry failed training — waste of GPU money
)
def train_lora(
    character_id: str,
    character_name: str,
    image_urls: list[str],
    webhook_url: str,
    num_train_steps: int = 800,
    learning_rate: float = 1e-4,
    lora_rank: int = 16,
    resolution: int = 1024,
):
    """
    Core training function. Runs on an A100-80GB GPU.
    Downloads images, trains FLUX LoRA, uploads weights, calls webhook.
    """
    import subprocess
    import requests
    import json
    from pathlib import Path
    from PIL import Image
    from io import BytesIO
    from huggingface_hub import login

    # Authenticate with HuggingFace (FLUX.1-dev is gated)
    hf_token = os.environ.get("HF_TOKEN")
    if hf_token:
        login(token=hf_token)
        print("✅ Logged in to HuggingFace")
    else:
        raise ValueError("HF_TOKEN not set — cannot access gated FLUX model")

    supabase_url = os.environ["SUPABASE_URL"]
    supabase_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

    print(f"🚀 FLUX LoRA training for: {character_name}")
    print(f"   Character ID: {character_id}")
    print(f"   Images: {len(image_urls)}")
    print(f"   Steps: {num_train_steps}, LR: {learning_rate}, Rank: {lora_rank}")
    print(f"   Resolution: {resolution}")

    # Setup directories
    work_dir = Path("/tmp/flux_training")
    work_dir.mkdir(exist_ok=True)
    images_dir = work_dir / "instance_images"
    images_dir.mkdir(exist_ok=True)
    output_dir = work_dir / "output"
    output_dir.mkdir(exist_ok=True)

    # Trigger word — simple unique token works best with FLUX
    trigger_word = f"TOK"
    instance_prompt = f"a photo of {trigger_word} person"

    try:
        # ─── Step 1: Download and validate training images ───
        print("\n📥 Downloading and validating images...")
        valid_count = 0
        max_images = 30  # More than 30 rarely helps and slows training

        for i, url in enumerate(image_urls[:max_images]):
            try:
                response = requests.get(url, timeout=60)
                response.raise_for_status()

                img = Image.open(BytesIO(response.content))

                # Validate image
                if img.size[0] < 128 or img.size[1] < 128:
                    print(f"   ⚠️ Skip image {i+1}: too small ({img.size})")
                    continue

                # Convert to RGB (remove alpha channel)
                img = img.convert("RGB")

                # Resize to training resolution, maintaining aspect ratio with center crop
                img = _resize_and_crop(img, resolution)

                img.save(images_dir / f"image_{valid_count:03d}.png", "PNG")
                valid_count += 1
                print(f"   ✓ Image {valid_count} saved ({img.size})")

            except Exception as e:
                print(f"   ⚠️ Skip image {i+1}: {e}")

        if valid_count < 5:
            raise ValueError(
                f"Need at least 5 valid images for training, got {valid_count}. "
                f"Please upload higher quality photos."
            )

        print(f"\n📸 {valid_count} valid training images prepared")

        # ─── Step 2: Download training script from diffusers ───
        print("\n📜 Fetching FLUX LoRA training script...")
        script_url = (
            "https://raw.githubusercontent.com/huggingface/diffusers/main/"
            "examples/dreambooth/train_dreambooth_lora_flux.py"
        )
        script_path = work_dir / "train_dreambooth_lora_flux.py"
        script_resp = requests.get(script_url, timeout=60)
        script_resp.raise_for_status()
        script_path.write_text(script_resp.text)
        print("   ✓ Training script ready")

        # ─── Step 3: Build training command ───
        # Adjust batch size based on resolution to fit in 80GB VRAM
        if resolution >= 1024:
            train_batch_size = 1
            gradient_accumulation = 4
        else:
            train_batch_size = 2
            gradient_accumulation = 2

        cmd = [
            "accelerate", "launch",
            "--mixed_precision", "bf16",  # FLUX uses bf16 natively
            "--num_processes", "1",
            str(script_path),
            "--pretrained_model_name_or_path", FLUX_MODEL_ID,
            "--instance_data_dir", str(images_dir),
            "--instance_prompt", instance_prompt,
            "--output_dir", str(output_dir),
            "--resolution", str(resolution),
            "--train_batch_size", str(train_batch_size),
            "--gradient_accumulation_steps", str(gradient_accumulation),
            "--max_train_steps", str(num_train_steps),
            "--learning_rate", str(learning_rate),
            "--lr_scheduler", "cosine",
            "--lr_warmup_steps", str(max(num_train_steps // 10, 50)),
            "--gradient_checkpointing",
            "--use_8bit_adam",
            "--rank", str(lora_rank),
            "--cache_dir", CACHE_DIR,
            "--seed", "42",
            "--dataloader_num_workers", "2",
        ]

        print(f"\n🔧 Starting FLUX LoRA training ({num_train_steps} steps)...")
        print(f"   Command: {' '.join(cmd[:6])}...")

        # ─── Step 4: Run training ───
        env = os.environ.copy()
        env["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=str(work_dir),
            env=env,
        )

        # Log output (truncate to avoid overwhelming logs)
        if result.stdout:
            lines = result.stdout.strip().split("\n")
            print(f"\n📋 Training output ({len(lines)} lines):")
            # Print first 20 and last 30 lines
            for line in lines[:20]:
                print(f"   {line}")
            if len(lines) > 50:
                print(f"   ... ({len(lines) - 50} lines omitted) ...")
            for line in lines[-30:]:
                print(f"   {line}")

        if result.returncode != 0:
            stderr_tail = result.stderr[-3000:] if result.stderr else "No stderr"
            print(f"\n❌ STDERR:\n{stderr_tail}")
            raise RuntimeError(
                f"Training failed with exit code {result.returncode}. "
                f"Last error: {stderr_tail[-500:]}"
            )

        # Commit model cache so next training run doesn't re-download FLUX
        model_cache.commit()
        print("   ✓ Model cache committed")

        # ─── Step 5: Find output LoRA weights ───
        lora_file = output_dir / "pytorch_lora_weights.safetensors"
        if not lora_file.exists():
            # Check alternative locations
            candidates = list(output_dir.rglob("*.safetensors"))
            if not candidates:
                raise FileNotFoundError(
                    f"No safetensors found in {output_dir}. "
                    f"Contents: {list(output_dir.rglob('*'))}"
                )
            lora_file = candidates[0]
            print(f"   Found weights at: {lora_file}")

        file_size_mb = lora_file.stat().st_size / (1024 * 1024)
        print(f"\n📦 LoRA weights: {lora_file.name} ({file_size_mb:.1f} MB)")

        # ─── Step 6: Upload to Supabase Storage ───
        print("\n☁️ Uploading to Supabase Storage...")
        with open(lora_file, "rb") as f:
            lora_bytes = f.read()

        storage_path = f"{character_id}/lora.safetensors"
        upload_url = (
            f"{supabase_url.rstrip('/')}/storage/v1/object/loras/{storage_path}"
        )
        headers = {
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/octet-stream",
            "x-upsert": "true",
        }

        upload_resp = requests.post(
            upload_url,
            headers=headers,
            data=lora_bytes,
            timeout=300,  # Large file upload
        )

        if upload_resp.status_code not in (200, 201):
            # Try creating the bucket first if it doesn't exist
            print(f"   ⚠️ Upload failed ({upload_resp.status_code}), trying to create bucket...")
            bucket_url = f"{supabase_url.rstrip('/')}/storage/v1/bucket"
            bucket_resp = requests.post(
                bucket_url,
                headers={"Authorization": f"Bearer {supabase_key}", "Content-Type": "application/json"},
                json={"id": "loras", "name": "loras", "public": True},
                timeout=30,
            )
            print(f"   Bucket creation: {bucket_resp.status_code}")

            # Retry upload
            upload_resp = requests.post(
                upload_url,
                headers=headers,
                data=lora_bytes,
                timeout=300,
            )

        if upload_resp.status_code not in (200, 201):
            raise RuntimeError(
                f"Failed to upload LoRA to Supabase: "
                f"{upload_resp.status_code} - {upload_resp.text[:500]}"
            )

        model_url = (
            f"{supabase_url.rstrip('/')}/storage/v1/object/public/loras/{storage_path}"
        )
        print(f"   ✅ Uploaded: {model_url}")

        # ─── Step 7: Call webhook ───
        print(f"\n📞 Calling webhook: {webhook_url}")
        webhook_payload = {
            "character_id": character_id,
            "status": "ready",
            "model_url": model_url,
            "trigger_word": trigger_word,
            "training_config": {
                "steps": num_train_steps,
                "learning_rate": learning_rate,
                "rank": lora_rank,
                "resolution": resolution,
                "num_images": valid_count,
                "base_model": FLUX_MODEL_ID,
            },
        }
        webhook_resp = requests.post(
            webhook_url,
            json=webhook_payload,
            timeout=30,
        )
        print(f"   Webhook response: {webhook_resp.status_code}")

        print("\n🎉 Training complete!")
        return {
            "success": True,
            "model_url": model_url,
            "trigger_word": trigger_word,
            "file_size_mb": round(file_size_mb, 1),
            "num_images_used": valid_count,
        }

    except Exception as e:
        print(f"\n❌ Training failed: {e}")
        import traceback
        traceback.print_exc()

        # Notify webhook of failure
        try:
            requests.post(
                webhook_url,
                json={
                    "character_id": character_id,
                    "status": "failed",
                    "error": str(e),
                },
                timeout=30,
            )
        except Exception:
            print("⚠️ Failed to send failure webhook")

        return {"success": False, "error": str(e)}


def _resize_and_crop(img: "Image.Image", target_size: int) -> "Image.Image":
    """Resize image to target_size x target_size with center crop."""
    from PIL import Image as PILImage

    w, h = img.size
    # Scale so shortest side equals target_size
    scale = target_size / min(w, h)
    new_w = int(w * scale)
    new_h = int(h * scale)
    img = img.resize((new_w, new_h), PILImage.Resampling.LANCZOS)

    # Center crop to exact target_size x target_size
    left = (new_w - target_size) // 2
    top = (new_h - target_size) // 2
    img = img.crop((left, top, left + target_size, top + target_size))
    return img


# ─── HTTP Endpoint to trigger training ───

@app.function(
    image=training_image,
    secrets=[
        modal.Secret.from_name("supabase-credentials"),
    ],
    timeout=60,
)
@modal.web_endpoint(method="POST", label="carmi-train-lora")
def start_training(request: dict):
    """
    HTTP endpoint to kick off LoRA training.
    Called from Next.js API route.

    Expected JSON body:
    {
        "character_id": "uuid",
        "character_name": "John",
        "reference_image_urls": ["https://...", ...],
        "webhook_url": "https://your-app.com/api/webhooks/training-complete",
        "num_train_steps": 800,        // optional
        "learning_rate": 1e-4,         // optional
        "lora_rank": 16,               // optional
        "resolution": 1024             // optional
    }
    """
    # Validate required fields
    character_id = request.get("character_id")
    character_name = request.get("character_name")
    image_urls = request.get("reference_image_urls", request.get("image_urls", []))
    webhook_url = request.get("webhook_url")

    errors = []
    if not character_id:
        errors.append("character_id is required")
    if not character_name:
        errors.append("character_name is required")
    if not image_urls or len(image_urls) < 5:
        errors.append("At least 5 reference_image_urls are required")
    if not webhook_url:
        errors.append("webhook_url is required")

    if errors:
        return {"success": False, "errors": errors}

    # Optional training parameters with sensible defaults
    num_train_steps = request.get("num_train_steps", 800)
    learning_rate = request.get("learning_rate", 1e-4)
    lora_rank = request.get("lora_rank", 16)
    resolution = request.get("resolution", 1024)

    # Spawn training as a background task (returns immediately)
    train_lora.spawn(
        character_id=character_id,
        character_name=character_name,
        image_urls=image_urls,
        webhook_url=webhook_url,
        num_train_steps=num_train_steps,
        learning_rate=learning_rate,
        lora_rank=lora_rank,
        resolution=resolution,
    )

    return {
        "success": True,
        "message": f"FLUX LoRA training started for '{character_name}'",
        "character_id": character_id,
        "config": {
            "num_images": len(image_urls),
            "num_train_steps": num_train_steps,
            "resolution": resolution,
            "lora_rank": lora_rank,
        },
    }