# modal_endpoint/train_lora.py
"""
Modal FLUX.1-dev LoRA training — in-process, fixed identity learning.
"""

import modal
import os

app = modal.App("carmi-flux-lora-training")

training_image = (
    modal.Image.from_registry(
        "nvidia/cuda:12.4.1-devel-ubuntu22.04",
        add_python="3.11",
    )
    .apt_install("git", "libgl1-mesa-glx", "libglib2.0-0")
    .pip_install(
        "torch==2.5.1",
        "torchvision==0.20.1",
        extra_index_url="https://download.pytorch.org/whl/cu124",
    )
    .pip_install(
        "accelerate>=0.31.0",
        "transformers>=4.43.0",
        "peft>=0.12.0",
        "fastapi",
        "uvicorn",
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
    )
    .pip_install(
        "diffusers[torch] @ git+https://github.com/huggingface/diffusers.git",
    )
    .run_commands(
        "python -c 'import torch; print(f\"PyTorch {torch.__version__}, CUDA: {torch.cuda.is_available()}\")'",
        "python -c 'from transformers import CLIPTextModel; print(\"CLIPTextModel OK\")'",
        "python -c 'from diffusers import FluxPipeline; print(\"FluxPipeline OK\")'",
    )
)

model_cache = modal.Volume.from_name("flux-model-cache", create_if_missing=True)
CACHE_DIR = "/root/.cache/huggingface/hub"
FLUX_MODEL_ID = "black-forest-labs/FLUX.1-dev"


@app.function(
    image=training_image,
    gpu="A100-80GB",
    timeout=7200,
    secrets=[
        modal.Secret.from_name("huggingface-secret"),
        modal.Secret.from_name("supabase-secret"),
    ],
    volumes={CACHE_DIR: model_cache},
    retries=0,
)
def train_lora(
    character_id: str,
    character_name: str,
    image_urls: list[str],
    webhook_url: str,
    num_train_steps: int = 2000,
    learning_rate: float = 4e-5,
    lora_rank: int = 64,
    resolution: int = 512,
):
    import torch
    import requests
    import gc
    from pathlib import Path
    from PIL import Image
    from io import BytesIO
    from huggingface_hub import login

    hf_token = os.environ.get("HF_TOKEN")
    if hf_token:
        login(token=hf_token)
        print("✅ Logged in to HuggingFace")

    supabase_url = os.environ["SUPABASE_URL"]
    supabase_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

    print(f"🚀 FLUX LoRA training for: {character_name}")
    print(f"   Character ID: {character_id}")
    print(f"   Images: {len(image_urls)}")
    print(f"   Steps: {num_train_steps}, LR: {learning_rate}, Rank: {lora_rank}")
    print(f"   Resolution: {resolution}")
    print(f"   PyTorch: {torch.__version__}, CUDA: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"   GPU: {torch.cuda.get_device_name(0)}")
        print(f"   VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")

    work_dir = Path("/tmp/flux_training")
    work_dir.mkdir(exist_ok=True)
    images_dir = work_dir / "instance_images"
    images_dir.mkdir(exist_ok=True)
    output_dir = work_dir / "output"
    output_dir.mkdir(exist_ok=True)

    trigger_word = "TOK"

    try:
        # ─── Download images ───
        print("\n📥 Downloading and validating images...")
        valid_count = 0
        for i, url in enumerate(image_urls[:30]):
            try:
                response = requests.get(url, timeout=60)
                response.raise_for_status()
                img = Image.open(BytesIO(response.content))
                if img.size[0] < 128 or img.size[1] < 128:
                    continue
                img = img.convert("RGB")
                img = _resize_and_crop(img, resolution)
                img.save(images_dir / f"image_{valid_count:03d}.png", "PNG")
                valid_count += 1
                print(f"   ✓ Image {valid_count} saved ({img.size})")
            except Exception as e:
                print(f"   ⚠️ Skip image {i+1}: {e}")

        if valid_count < 5:
            raise ValueError(f"Need at least 5 valid images, got {valid_count}")
        print(f"\n📸 {valid_count} valid training images prepared")

        # ─── Use FluxPipeline approach for correct training ───
        print("\n🔧 Loading pipeline for training...")

        from diffusers import FluxPipeline, AutoencoderKL, FluxTransformer2DModel
        from diffusers import FlowMatchEulerDiscreteScheduler
        from transformers import CLIPTextModel, CLIPTokenizer, T5EncoderModel, T5TokenizerFast
        from peft import LoraConfig, get_peft_model_state_dict
        from safetensors.torch import save_file
        from torch.utils.data import Dataset, DataLoader
        from torchvision import transforms
        import torch.nn.functional as F
        from diffusers.optimization import get_scheduler
        import numpy as np

        # Load full pipeline first to get correct behavior
        print("   Loading full FluxPipeline...")
        pipe = FluxPipeline.from_pretrained(
            FLUX_MODEL_ID,
            torch_dtype=torch.bfloat16,
            cache_dir=CACHE_DIR,
        )
        model_cache.commit()

        # Extract components
        tokenizer_one = pipe.tokenizer
        tokenizer_two = pipe.tokenizer_2
        text_encoder_one = pipe.text_encoder
        text_encoder_two = pipe.text_encoder_2
        vae = pipe.vae
        transformer = pipe.transformer
        scheduler = pipe.scheduler

        # Freeze everything
        vae.requires_grad_(False)
        text_encoder_one.requires_grad_(False)
        text_encoder_two.requires_grad_(False)
        transformer.requires_grad_(False)

        # Move to devices
        vae.to("cuda", dtype=torch.bfloat16)
        text_encoder_one.to("cuda", dtype=torch.bfloat16)
        text_encoder_two.to("cuda", dtype=torch.bfloat16)
        transformer.to("cuda", dtype=torch.bfloat16)

        # Add LoRA
        print(f"   Adding LoRA (rank={lora_rank})...")
        lora_config = LoraConfig(
            r=lora_rank,
            lora_alpha=lora_rank,
            target_modules=[
                "to_q", "to_k", "to_v", "to_out.0",
                "add_q_proj", "add_k_proj", "add_v_proj", "to_add_out",
                "proj_out",
            ],
            lora_dropout=0.0,
        )
        transformer.add_adapter(lora_config)
        transformer.enable_adapters()

        trainable_params = sum(p.numel() for p in transformer.parameters() if p.requires_grad)
        total_params = sum(p.numel() for p in transformer.parameters())
        print(f"   Trainable: {trainable_params:,} / {total_params:,} ({100 * trainable_params / total_params:.2f}%)")

        transformer.enable_gradient_checkpointing()

        # ─── Pre-encode prompts using the pipeline's own method ───
        print("   Pre-encoding prompts...")

        # Use varied prompts to help identity learning
        prompts = [
            f"a photo of {trigger_word} person",
            f"a portrait of {trigger_word} person, high quality",
            f"a close-up photo of {trigger_word} person, detailed face",
            f"a photo of {trigger_word} person looking at the camera",
            f"a professional photo of {trigger_word} person",
        ]

        encoded_prompts = []
        with torch.no_grad():
            for prompt_text in prompts:
                prompt_embeds, pooled_prompt_embeds, text_ids = pipe.encode_prompt(
                    prompt=prompt_text,
                    prompt_2=prompt_text,
                )
                encoded_prompts.append({
                    "prompt_embeds": prompt_embeds.to("cuda"),
                    "pooled_prompt_embeds": pooled_prompt_embeds.to("cuda"),
                    "text_ids": text_ids.to("cuda"),
                })

        print(f"   Encoded {len(encoded_prompts)} prompt variants")
        print(f"   prompt_embeds shape: {encoded_prompts[0]['prompt_embeds'].shape}")
        print(f"   pooled shape: {encoded_prompts[0]['pooled_prompt_embeds'].shape}")
        print(f"   text_ids shape: {encoded_prompts[0]['text_ids'].shape}")

        # Free text encoders
        text_encoder_one.to("cpu")
        text_encoder_two.to("cpu")
        del text_encoder_one, text_encoder_two
        gc.collect()
        torch.cuda.empty_cache()
        print(f"   VRAM after freeing encoders: {torch.cuda.memory_allocated() / 1024**3:.1f} GB")

        # ─── Dataset ───
        class InstanceDataset(Dataset):
            def __init__(self, data_dir, size):
                self.images = sorted(list(Path(data_dir).glob("*.png")))
                self.transform = transforms.Compose([
                    transforms.Resize(size, interpolation=transforms.InterpolationMode.LANCZOS),
                    transforms.CenterCrop(size),
                    transforms.ToTensor(),
                    transforms.Normalize([0.5], [0.5]),
                ])

            def __len__(self):
                return len(self.images)

            def __getitem__(self, idx):
                img = Image.open(self.images[idx % len(self.images)]).convert("RGB")
                return {"pixel_values": self.transform(img)}

        dataset = InstanceDataset(images_dir, resolution)
        dataloader = DataLoader(dataset, batch_size=1, shuffle=True, num_workers=0)

        # Optimizer
        optimizer = torch.optim.AdamW(
            [p for p in transformer.parameters() if p.requires_grad],
            lr=learning_rate,
            weight_decay=1e-2,
        )

        lr_scheduler_obj = get_scheduler(
            "cosine",
            optimizer=optimizer,
            num_warmup_steps=min(num_train_steps // 10, 100),
            num_training_steps=num_train_steps,
        )

        # ─── Prepare VAE + packing helpers ───
        vae_scale_factor = 2 ** (len(vae.config.block_out_channels) - 1)

        def pack_latents(latents):
            # [B, C, H, W] -> [B, C*4, H/2, W/2] -> [B, H/2*W/2, C*4]
            bs, c, h, w = latents.shape
            latents = latents.reshape(bs, c, h // 2, 2, w // 2, 2)
            latents = latents.permute(0, 2, 4, 1, 3, 5)
            latents = latents.reshape(bs, (h // 2) * (w // 2), c * 4)
            return latents, h // 2, w // 2

        def get_image_ids(h, w, bs):
            img_ids = torch.zeros(h, w, 3)
            img_ids[..., 1] = torch.arange(h)[:, None]
            img_ids[..., 2] = torch.arange(w)[None, :]
            img_ids = img_ids.reshape(h * w, 3)
            img_ids = img_ids.unsqueeze(0).repeat(bs, 1, 1)
            return img_ids.to(device="cuda", dtype=torch.bfloat16)

        # ─── Training loop ───
        print(f"\n🏋️ Training for {num_train_steps} steps...")
        transformer.train()
        global_step = 0
        data_iter = iter(dataloader)
        losses = []

        for step in range(num_train_steps):
            try:
                batch = next(data_iter)
            except StopIteration:
                data_iter = iter(dataloader)
                batch = next(data_iter)

            pixel_values = batch["pixel_values"].to("cuda", dtype=torch.bfloat16)
            bs = pixel_values.shape[0]

            # Pick a random prompt variant
            enc = encoded_prompts[step % len(encoded_prompts)]
            prompt_embeds = enc["prompt_embeds"][:bs]
            pooled_prompt_embeds = enc["pooled_prompt_embeds"][:bs]
            text_ids = enc["text_ids"][:bs]

            # Encode to latents
            with torch.no_grad():
                latent_dist = vae.encode(pixel_values).latent_dist
                latents = latent_dist.sample()
                latents = (latents - vae.config.shift_factor) * vae.config.scaling_factor

                # Pack latents
                packed_latents, packed_h, packed_w = pack_latents(latents)
                img_ids = get_image_ids(packed_h, packed_w, bs)

            # Sample noise
            noise = torch.randn_like(packed_latents)

            # Sample timesteps (logit-normal distribution, better for FLUX)
            u = torch.normal(mean=0.0, std=1.0, size=(bs,), device="cuda")
            timesteps = torch.sigmoid(u).to(dtype=torch.bfloat16)

            # Flow matching interpolation
            noisy_latents = (1.0 - timesteps[:, None, None]) * packed_latents + timesteps[:, None, None] * noise

            # Forward
            model_pred = transformer(
                hidden_states=noisy_latents,
                timestep=timesteps * 1000,
                guidance=torch.full((bs,), 1.0, device="cuda", dtype=torch.bfloat16) * 1000,
                encoder_hidden_states=prompt_embeds,
                pooled_projections=pooled_prompt_embeds,
                txt_ids=text_ids,
                img_ids=img_ids,
                return_dict=False,
            )[0]

            # Loss: predict the velocity field (noise - clean)
            target = noise - packed_latents
            loss = F.mse_loss(model_pred.float(), target.float(), reduction="mean")

            loss.backward()
            torch.nn.utils.clip_grad_norm_(
                [p for p in transformer.parameters() if p.requires_grad], 1.0
            )
            optimizer.step()
            lr_scheduler_obj.step()
            optimizer.zero_grad()

            global_step += 1
            losses.append(loss.item())

            if global_step % 50 == 0 or global_step == 1:
                avg_loss = sum(losses[-50:]) / len(losses[-50:])
                print(f"   Step {global_step}/{num_train_steps} | Loss: {loss.item():.4f} | Avg: {avg_loss:.4f} | LR: {lr_scheduler_obj.get_last_lr()[0]:.2e}")

            if global_step % 200 == 0:
                vram_used = torch.cuda.memory_allocated() / 1024**3
                print(f"   VRAM: {vram_used:.1f} GB")

        avg_final = sum(losses[-100:]) / len(losses[-100:])
        print(f"\n✅ Training complete! Final avg loss: {avg_final:.4f}")

        # ─── Save LoRA ───
        print("\n💾 Saving LoRA weights...")

        # Get the state dict properly
        lora_state_dict = get_peft_model_state_dict(transformer)

        # Clean up key names for compatibility with diffusers load_lora_weights
        cleaned_state_dict = {}
        for key, value in lora_state_dict.items():
            # Remove 'base_model.model.' prefix if present
            clean_key = key.replace("base_model.model.", "")
            cleaned_state_dict[clean_key] = value

        lora_path = output_dir / "pytorch_lora_weights.safetensors"
        save_file(cleaned_state_dict, str(lora_path))

        file_size_mb = lora_path.stat().st_size / (1024 * 1024)
        print(f"   LoRA saved: {lora_path.name} ({file_size_mb:.1f} MB, {len(cleaned_state_dict)} tensors)")

        # ─── Upload to Supabase ───
        print("\n☁️ Uploading to Supabase Storage...")
        with open(lora_path, "rb") as f:
            lora_bytes = f.read()

        storage_path = f"{character_id}/lora.safetensors"
        upload_url = f"{supabase_url.rstrip('/')}/storage/v1/object/loras/{storage_path}"
        headers = {
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/octet-stream",
            "x-upsert": "true",
        }
        upload_resp = requests.post(upload_url, headers=headers, data=lora_bytes, timeout=300)

        if upload_resp.status_code not in (200, 201):
            bucket_url = f"{supabase_url.rstrip('/')}/storage/v1/bucket"
            requests.post(
                bucket_url,
                headers={"Authorization": f"Bearer {supabase_key}", "Content-Type": "application/json"},
                json={"id": "loras", "name": "loras", "public": True},
                timeout=30,
            )
            upload_resp = requests.post(upload_url, headers=headers, data=lora_bytes, timeout=300)

        if upload_resp.status_code not in (200, 201):
            raise RuntimeError(f"Upload failed: {upload_resp.status_code} - {upload_resp.text[:500]}")

        model_url = f"{supabase_url.rstrip('/')}/storage/v1/object/public/loras/{storage_path}"
        print(f"   ✅ Uploaded: {model_url}")

        # ─── Webhook ───
        print(f"\n📞 Calling webhook...")
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

        print("\n🎉 Training complete!")
        return {"success": True, "model_url": model_url, "trigger_word": trigger_word}

    except Exception as e:
        print(f"\n❌ Training failed: {e}")
        import traceback
        traceback.print_exc()
        try:
            requests.post(
                webhook_url,
                json={"character_id": character_id, "status": "failed", "error": str(e)},
                timeout=30,
            )
        except Exception:
            pass
        return {"success": False, "error": str(e)}


def _resize_and_crop(img, target_size):
    from PIL import Image as PILImage
    w, h = img.size
    scale = target_size / min(w, h)
    new_w, new_h = int(w * scale), int(h * scale)
    img = img.resize((new_w, new_h), PILImage.Resampling.LANCZOS)
    left = (new_w - target_size) // 2
    top = (new_h - target_size) // 2
    return img.crop((left, top, left + target_size, top + target_size))


@app.function(
    image=training_image,
    secrets=[modal.Secret.from_name("supabase-secret")],
    timeout=60,
)
@modal.web_endpoint(method="POST", label="carmi-train-lora")
def start_training(request: dict):
    character_id = request.get("character_id")
    character_name = request.get("character_name")
    image_urls = request.get("reference_image_urls", request.get("image_urls", []))
    webhook_url = request.get("webhook_url")

    errors = []
    if not character_id: errors.append("character_id required")
    if not character_name: errors.append("character_name required")
    if not image_urls or len(image_urls) < 5: errors.append("At least 5 images required")
    if not webhook_url: errors.append("webhook_url required")
    if errors:
        return {"success": False, "errors": errors}

    train_lora.spawn(
        character_id=character_id,
        character_name=character_name,
        image_urls=image_urls,
        webhook_url=webhook_url,
        num_train_steps=request.get("num_train_steps", 2000),
        learning_rate=request.get("learning_rate", 4e-5),
        lora_rank=request.get("lora_rank", 64),
        resolution=request.get("resolution", 512),
    )

    return {
        "success": True,
        "message": f"FLUX LoRA training started for '{character_name}'",
        "character_id": character_id,
        "config": {
            "num_images": len(image_urls),
            "num_train_steps": request.get("num_train_steps", 2000),
            "resolution": request.get("resolution", 512),
            "lora_rank": request.get("lora_rank", 64),
        },
    }