# modal_training/generate_flux_lora.py
"""
Modal FLUX.1-dev inference with LoRA endpoint.
Loads base FLUX model + LoRA weights and generates images.
"""

import modal
import os
import io
import base64
import uuid

app = modal.App("carmi-flux-lora-inference")

inference_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "libgl1-mesa-glx", "libglib2.0-0")
    .pip_install(
        "torch==2.3.1",
        "torchvision==0.18.1",
        "accelerate>=0.31.0",
        "transformers>=4.43.0",
        "diffusers[torch] @ git+https://github.com/huggingface/diffusers.git",
        "peft>=0.12.0",
        "fastapi",
        "uvicorn",
        "safetensors",
        "Pillow>=10.0.0",
        "requests",
        "sentencepiece",
        "protobuf",
        "huggingface_hub>=0.23.0",
    )
)

model_cache = modal.Volume.from_name("flux-model-cache", create_if_missing=True)
CACHE_DIR = "/root/.cache/huggingface/hub"


@app.cls(
    image=inference_image,
    gpu="A100-80GB",
    timeout=600,  # 10 minutes max per generation
    secrets=[
        modal.Secret.from_name("huggingface-secret"),
        modal.Secret.from_name("supabase-credentials"),
    ],
    volumes={CACHE_DIR: model_cache},
    container_idle_timeout=120,  # Keep warm for 2 minutes between requests
)
class FluxLoraGenerator:
    """
    Persistent class that keeps the base FLUX model loaded in GPU memory.
    LoRA weights are swapped per request.
    """

    @modal.enter()
    def load_base_model(self):
        """Load FLUX base model once when container starts."""
        import torch
        from diffusers import FluxPipeline
        from huggingface_hub import login

        hf_token = os.environ.get("HF_TOKEN")
        if hf_token:
            login(token=hf_token)

        print("🔄 Loading FLUX.1-dev base model...")
        self.pipe = FluxPipeline.from_pretrained(
            "black-forest-labs/FLUX.1-dev",
            torch_dtype=torch.bfloat16,
            cache_dir=CACHE_DIR,
        )
        self.pipe.to("cuda")
        self.pipe.enable_model_cpu_offload()
        print("✅ FLUX.1-dev loaded and ready")

        # Track currently loaded LoRA to avoid reloading
        self._current_lora_url = None

    @modal.method()
    def generate(
        self,
        prompt: str,
        model_url: str,
        trigger_word: str = "TOK",
        negative_prompt: str = "",
        num_inference_steps: int = 28,
        guidance_scale: float = 3.5,
        width: int = 1024,
        height: int = 1024,
        seed: int = -1,
        lora_scale: float = 0.85,
    ) -> dict:
        """Generate an image with a LoRA applied to FLUX."""
        import torch
        import requests
        from pathlib import Path

        try:
            # Download and load LoRA if different from currently loaded one
            if model_url != self._current_lora_url:
                print(f"🔄 Loading LoRA from: {model_url}")

                # Unload previous LoRA
                if self._current_lora_url is not None:
                    self.pipe.unload_lora_weights()

                # Download LoRA weights
                lora_path = Path("/tmp/current_lora.safetensors")
                resp = requests.get(model_url, timeout=120)
                resp.raise_for_status()
                lora_path.write_bytes(resp.content)
                print(f"   Downloaded: {lora_path.stat().st_size / 1024 / 1024:.1f} MB")

                # Load LoRA into pipeline
                self.pipe.load_lora_weights(str(lora_path))
                self._current_lora_url = model_url
                print("   ✅ LoRA loaded")

            # Ensure trigger word is in prompt
            if trigger_word and trigger_word not in prompt:
                prompt = f"{trigger_word} {prompt}"

            # Set seed
            generator = None
            if seed >= 0:
                generator = torch.Generator("cuda").manual_seed(seed)
            else:
                seed = torch.randint(0, 2**32, (1,)).item()
                generator = torch.Generator("cuda").manual_seed(seed)

            print(f"🎨 Generating image...")
            print(f"   Prompt: {prompt[:100]}...")
            print(f"   Size: {width}x{height}, Steps: {num_inference_steps}")
            print(f"   Seed: {seed}, LoRA scale: {lora_scale}")

            # Generate
            result = self.pipe(
                prompt=prompt,
                num_inference_steps=num_inference_steps,
                guidance_scale=guidance_scale,
                width=width,
                height=height,
                generator=generator,
                joint_attention_kwargs={"scale": lora_scale},
            )

            image = result.images[0]

            # Upload to Supabase Storage
            supabase_url = os.environ["SUPABASE_URL"]
            supabase_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

            img_buffer = io.BytesIO()
            image.save(img_buffer, format="PNG", quality=95)
            img_bytes = img_buffer.getvalue()

            file_name = f"{uuid.uuid4().hex}.png"
            storage_path = f"generations/{file_name}"
            upload_url = f"{supabase_url.rstrip('/')}/storage/v1/object/generations/{storage_path}"

            upload_resp = requests.post(
                upload_url,
                headers={
                    "Authorization": f"Bearer {supabase_key}",
                    "Content-Type": "image/png",
                    "x-upsert": "true",
                },
                data=img_bytes,
                timeout=120,
            )

            if upload_resp.status_code not in (200, 201):
                # Fallback: return as base64
                print(f"⚠️ Upload failed: {upload_resp.status_code}")
                img_b64 = base64.b64encode(img_bytes).decode()
                return {
                    "success": True,
                    "image_base64": img_b64,
                    "seed": seed,
                }

            public_url = f"{supabase_url.rstrip('/')}/storage/v1/object/public/generations/{storage_path}"
            print(f"✅ Image generated and uploaded: {public_url}")

            return {
                "success": True,
                "image_url": public_url,
                "seed": seed,
            }

        except Exception as e:
            print(f"❌ Generation failed: {e}")
            import traceback
            traceback.print_exc()
            return {"success": False, "error": str(e)}

    @modal.web_endpoint(method="POST", label="carmi-generate-lora")
    def generate_endpoint(self, request: dict) -> dict:
        """HTTP endpoint for image generation."""
        required = ["prompt", "model_url"]
        for field in required:
            if field not in request:
                return {"success": False, "error": f"Missing required field: {field}"}

        return self.generate(
            prompt=request["prompt"],
            model_url=request["model_url"],
            trigger_word=request.get("trigger_word", "TOK"),
            negative_prompt=request.get("negative_prompt", ""),
            num_inference_steps=request.get("num_inference_steps", 28),
            guidance_scale=request.get("guidance_scale", 3.5),
            width=request.get("width", 1024),
            height=request.get("height", 1024),
            seed=request.get("seed", -1),
            lora_scale=request.get("lora_scale", 0.85),
        )