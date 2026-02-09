# modal_endpoint/generate_flux_lora.py
"""
Modal FLUX.1-dev inference - Compatible with FAL-trained LoRAs
"""

import modal
import os
import io
import base64
import uuid

app = modal.App("carmi-flux-lora-inference")

inference_image = (
    modal.Image.from_registry(
        "nvidia/cuda:12.4.1-devel-ubuntu22.04",
        add_python="3.11",
    )
    .apt_install("git", "libgl1-mesa-glx", "libglib2.0-0")
    .run_commands("pip install 'numpy==1.26.4' --force-reinstall")
    .pip_install(
        "torch==2.5.1",
        "torchvision==0.20.1",
        extra_index_url="https://download.pytorch.org/whl/cu124",
    )
    .run_commands("pip install 'numpy==1.26.4' --force-reinstall")
    .pip_install(
        "accelerate>=0.31.0",
        "transformers>=4.44.0,<4.46.0",
        "peft>=0.12.0",
        "safetensors",
        "Pillow>=10.0.0",
        "fastapi",
        "uvicorn",
        "requests",
        "sentencepiece",
        "protobuf",
        "huggingface_hub>=0.25.0,<1.0",
        "diffusers>=0.30.0,<0.32.0",
    )
)

model_cache = modal.Volume.from_name("flux-model-cache", create_if_missing=True)
CACHE_DIR = "/root/.cache/huggingface/hub"


@app.cls(
    image=inference_image,
    gpu="A100-80GB",
    timeout=600,
    secrets=[
        modal.Secret.from_name("huggingface-secret"),
        modal.Secret.from_name("supabase-secret"),
    ],
    volumes={CACHE_DIR: model_cache},
    container_idle_timeout=300,
    allow_concurrent_inputs=5,
)
class FluxLoraGenerator:

    @modal.enter()
    def load_base_model(self):
        import torch
        from diffusers import FluxPipeline
        from huggingface_hub import login

        hf_token = os.environ.get("HF_TOKEN")
        if hf_token:
            login(token=hf_token)

        print("Loading FLUX.1-dev...")
        self.pipe = FluxPipeline.from_pretrained(
            "black-forest-labs/FLUX.1-dev",
            torch_dtype=torch.bfloat16,
            cache_dir=CACHE_DIR,
        )
        self.pipe.to("cuda")
        print("FLUX.1-dev loaded!")

        self._current_lora_url = None

    def _generate_image(
        self,
        prompt: str,
        model_url: str,
        trigger_word: str = "ohwx",
        num_inference_steps: int = 28,
        guidance_scale: float = 3.5,
        width: int = 1024,
        height: int = 1024,
        seed: int = -1,
        lora_scale: float = 1.0,
    ) -> dict:
        import torch
        import requests
        from pathlib import Path

        try:
            # Load LoRA if different from current
            if model_url != self._current_lora_url:
                print(f"Loading LoRA from: {model_url}")

                # Unload previous LoRA
                if self._current_lora_url:
                    try:
                        self.pipe.unload_lora_weights()
                        print("   Previous LoRA unloaded")
                    except Exception as e:
                        print(f"   Could not unload: {e}")

                # Download LoRA
                lora_path = Path("/tmp/current_lora.safetensors")
                resp = requests.get(model_url, timeout=120)
                resp.raise_for_status()
                lora_path.write_bytes(resp.content)
                size_mb = lora_path.stat().st_size / (1024 * 1024)
                print(f"   Downloaded: {size_mb:.1f} MB")

                # Load LoRA - FAL produces standard diffusers format
                self.pipe.load_lora_weights(
                    str(lora_path),
                    adapter_name="character"
                )
                self.pipe.set_adapters(["character"], adapter_weights=[lora_scale])
                
                self._current_lora_url = model_url
                print("   LoRA loaded successfully!")

            # Add trigger word to prompt
            if trigger_word and trigger_word.lower() not in prompt.lower():
                prompt = f"{trigger_word} {prompt}"

            print(f"Generating: {prompt[:80]}...")

            # Handle seed
            if seed < 0:
                seed = torch.randint(0, 2**32, (1,)).item()
            generator = torch.Generator("cuda").manual_seed(seed)

            # Generate image
            result = self.pipe(
                prompt=prompt,
                num_inference_steps=num_inference_steps,
                guidance_scale=guidance_scale,
                width=width,
                height=height,
                generator=generator,
            )

            image = result.images[0]
            print("   Image generated!")

            # Upload to Supabase
            supabase_url = os.environ["SUPABASE_URL"]
            supabase_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

            img_buffer = io.BytesIO()
            image.save(img_buffer, format="PNG")
            img_bytes = img_buffer.getvalue()

            file_name = f"{uuid.uuid4().hex}.png"
            upload_url = f"{supabase_url}/storage/v1/object/generations/{file_name}"

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
                # Try creating bucket
                requests.post(
                    f"{supabase_url}/storage/v1/bucket",
                    headers={
                        "Authorization": f"Bearer {supabase_key}",
                        "Content-Type": "application/json"
                    },
                    json={"id": "generations", "name": "generations", "public": True},
                )
                upload_resp = requests.post(upload_url, headers={
                    "Authorization": f"Bearer {supabase_key}",
                    "Content-Type": "image/png",
                    "x-upsert": "true",
                }, data=img_bytes)

            if upload_resp.status_code in (200, 201):
                public_url = f"{supabase_url}/storage/v1/object/public/generations/{file_name}"
                print(f"✅ Uploaded: {public_url}")
                return {"success": True, "image_url": public_url, "seed": seed}
            else:
                print(f"Upload failed, returning base64")
                img_b64 = base64.b64encode(img_bytes).decode()
                return {"success": True, "image_base64": img_b64, "seed": seed}

        except Exception as e:
            print(f"❌ Error: {e}")
            import traceback
            traceback.print_exc()
            return {"success": False, "error": str(e)}

    @modal.method()
    def generate(self, **kwargs) -> dict:
        return self._generate_image(**kwargs)

    @modal.fastapi_endpoint(method="POST", label="carmi-generate-lora")
    def generate_endpoint(self, request: dict) -> dict:
        if "prompt" not in request or "model_url" not in request:
            return {"success": False, "error": "Missing prompt or model_url"}

        return self._generate_image(
            prompt=request["prompt"],
            model_url=request["model_url"],
            trigger_word=request.get("trigger_word", "ohwx"),
            num_inference_steps=request.get("num_inference_steps", 28),
            guidance_scale=request.get("guidance_scale", 3.5),
            width=request.get("width", 1024),
            height=request.get("height", 1024),
            seed=request.get("seed", -1),
            lora_scale=request.get("lora_scale", 1.0),
        )