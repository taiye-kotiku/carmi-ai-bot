# modal_endpoint/train_lora.py
"""
FLUX LoRA Training - Using ai-toolkit
"""

import modal
import os
import subprocess

app = modal.App("carmi-flux-lora-training")

training_image = (
    modal.Image.from_registry(
        "nvidia/cuda:12.4.1-devel-ubuntu22.04",
        add_python="3.11",
    )
    .apt_install("git", "libgl1-mesa-glx", "libglib2.0-0", "wget", "ffmpeg")
    .pip_install(
        "torch==2.4.0",
        "torchvision==0.19.0",
        "torchaudio==2.4.0",  # Added missing dependency
        extra_index_url="https://download.pytorch.org/whl/cu124",
    )
    .pip_install(
        "accelerate",
        "transformers",
        "peft",
        "safetensors",
        "Pillow",
        "requests",
        "huggingface_hub",
        "diffusers",
        "pyyaml",
        "oyaml",
        "tensorboard",
        "prodigyopt",
        "lycoris-lora",
        "flatten_json",
        "pyyaml",
        "oyaml",
        "albumentations",
        "opencv-python",
        "timm",
    )
    .run_commands(
        "git clone https://github.com/ostris/ai-toolkit.git /ai-toolkit",
        "cd /ai-toolkit && pip install -r requirements.txt",
    )
)

model_cache = modal.Volume.from_name("flux-model-cache", create_if_missing=True)


@app.function(
    image=training_image,
    gpu="A100-80GB",
    timeout=7200,
    secrets=[
        modal.Secret.from_name("huggingface-secret"),
        modal.Secret.from_name("supabase-secret"),
    ],
    volumes={"/cache": model_cache},
)
def train_lora(
    character_id: str,
    character_name: str,
    image_urls: list[str],
    webhook_url: str,
    steps: int = 500,
    lr: float = 1e-4,
    rank: int = 16,
):
    import torch
    import requests
    import json
    from pathlib import Path
    from PIL import Image
    from io import BytesIO
    from huggingface_hub import login

    os.environ["HF_HOME"] = "/cache"
    os.environ["TRANSFORMERS_CACHE"] = "/cache"
    
    hf_token = os.environ.get("HF_TOKEN")
    if hf_token:
        login(token=hf_token)

    supabase_url = os.environ["SUPABASE_URL"]
    supabase_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

    print(f"🚀 Training LoRA for: {character_name}")
    print(f"   Steps: {steps}, LR: {lr}, Rank: {rank}")

    work_dir = Path("/tmp/training")
    work_dir.mkdir(exist_ok=True)
    img_dir = work_dir / "images"
    img_dir.mkdir(exist_ok=True)
    out_dir = work_dir / "output"
    out_dir.mkdir(exist_ok=True)

    trigger = "ohwx"

    try:
        # Download images
        print("\n📥 Downloading images...")
        count = 0
        for i, url in enumerate(image_urls[:20]):
            try:
                r = requests.get(url, timeout=60)
                r.raise_for_status()
                img = Image.open(BytesIO(r.content)).convert("RGB")

                w, h = img.size
                s = min(w, h)
                left, top = (w - s) // 2, (h - s) // 2
                img = img.crop((left, top, left + s, top + s))
                img = img.resize((512, 512), Image.Resampling.LANCZOS)

                img.save(img_dir / f"{count:03d}.jpg", quality=95)
                (img_dir / f"{count:03d}.txt").write_text(f"photo of {trigger} person")

                count += 1
                print(f"   ✓ {count}")
            except Exception as e:
                print(f"   ✗ {e}")

        if count < 5:
            raise ValueError(f"Need ≥5 images, got {count}")

        print(f"\n📸 {count} images ready")

        # Create config
        config = {
            "job": "extension",
            "config": {
                "name": f"lora_{character_id[:8]}",
                "process": [
                    {
                        "type": "sd_trainer",
                        "training_folder": str(out_dir),
                        "device": "cuda:0",
                        "trigger_word": trigger,
                        "network": {
                            "type": "lora",
                            "linear": rank,
                            "linear_alpha": rank,
                        },
                        "save": {
                            "dtype": "float16",
                            "save_every": steps,
                            "max_step_saves_to_keep": 1,
                        },
                        "datasets": [
                            {
                                "folder_path": str(img_dir),
                                "caption_ext": "txt",
                                "caption_dropout_rate": 0.05,
                                "shuffle_tokens": False,
                                "cache_latents_to_disk": True,
                                "resolution": [512, 512],
                            }
                        ],
                        "train": {
                            "batch_size": 1,
                            "steps": steps,
                            "gradient_accumulation_steps": 1,
                            "train_unet": True,
                            "train_text_encoder": False,
                            "gradient_checkpointing": True,
                            "noise_scheduler": "flowmatch",
                            "optimizer": "adamw8bit",
                            "lr": lr,
                            "ema_config": {"use_ema": False},
                            "dtype": "bf16",
                        },
                        "model": {
                            "name_or_path": "black-forest-labs/FLUX.1-dev",
                            "is_flux": True,
                            "quantize": True,
                        },
                        "sample": {
                            "sampler": "flowmatch",
                            "sample_every": steps + 1,
                            "width": 512,
                            "height": 512,
                            "prompts": [],
                            "neg": "",
                            "seed": 42,
                            "walk_seed": True,
                            "guidance_scale": 4,
                            "sample_steps": 20,
                        },
                    }
                ],
            },
            "meta": {
                "name": f"[lora] {character_name}",
                "version": "1.0",
            },
        }

        config_path = work_dir / "config.yaml"
        import yaml
        with open(config_path, "w") as f:
            yaml.dump(config, f)

        print("\n🏋️ Starting training...")

        result = subprocess.run(
            ["python", "/ai-toolkit/run.py", str(config_path)],
            cwd="/ai-toolkit",
            capture_output=True,
            text=True,
            env={
                **os.environ,
                "HF_HOME": "/cache",
                "TRANSFORMERS_CACHE": "/cache",
            },
        )

        print("STDOUT:", result.stdout[-2000:] if len(result.stdout) > 2000 else result.stdout)
        
        if result.returncode != 0:
            print("STDERR:", result.stderr[-2000:] if len(result.stderr) > 2000 else result.stderr)
            raise RuntimeError(f"Training failed with code {result.returncode}")

        # Find LoRA file
        lora_files = list(out_dir.rglob("*.safetensors"))
        if not lora_files:
            raise RuntimeError("No LoRA file found")

        lora_path = lora_files[0]
        print(f"\n💾 LoRA: {lora_path} ({lora_path.stat().st_size / 1e6:.1f} MB)")

        # Upload
        print("\n☁️ Uploading...")
        with open(lora_path, "rb") as f:
            data = f.read()

        path = f"{character_id}/lora.safetensors"
        url = f"{supabase_url}/storage/v1/object/loras/{path}"

        r = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {supabase_key}",
                "Content-Type": "application/octet-stream",
                "x-upsert": "true",
            },
            data=data,
            timeout=300,
        )

        if r.status_code not in (200, 201):
            requests.post(
                f"{supabase_url}/storage/v1/bucket",
                headers={"Authorization": f"Bearer {supabase_key}", "Content-Type": "application/json"},
                json={"id": "loras", "name": "loras", "public": True},
            )
            r = requests.post(url, headers={
                "Authorization": f"Bearer {supabase_key}",
                "Content-Type": "application/octet-stream",
                "x-upsert": "true",
            }, data=data, timeout=300)

        model_url = f"{supabase_url}/storage/v1/object/public/loras/{path}"
        print(f"   ✅ {model_url}")

        requests.post(webhook_url, json={
            "character_id": character_id,
            "status": "ready",
            "model_url": model_url,
            "trigger_word": trigger,
        }, timeout=30)

        print("\n🎉 Done!")
        return {"success": True, "model_url": model_url}

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

        requests.post(webhook_url, json={
            "character_id": character_id,
            "status": "failed",
            "error": str(e),
        }, timeout=30)

        return {"success": False, "error": str(e)}


@app.function(
    image=training_image,
    secrets=[modal.Secret.from_name("supabase-secret")],
    timeout=60,
)
@modal.web_endpoint(method="POST", label="carmi-train-lora")
def start_training(request: dict):
    cid = request.get("character_id")
    cname = request.get("character_name")
    urls = request.get("reference_image_urls") or request.get("image_urls") or []
    webhook = request.get("webhook_url")

    if not cid or not cname or len(urls) < 5 or not webhook:
        return {"success": False, "error": "Missing required fields"}

    train_lora.spawn(
        character_id=cid,
        character_name=cname,
        image_urls=urls,
        webhook_url=webhook,
        steps=request.get("num_train_steps", 500),
        lr=request.get("learning_rate", 1e-4),
        rank=request.get("lora_rank", 16),
    )

    return {"success": True, "message": "Training started"}