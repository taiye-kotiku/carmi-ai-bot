# modal_endpoint/generate_flux_lora.py
"""
Modal FLUX.1-dev inference with LoRA.
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
    .pip_install(
        "torch==2.5.1",
        "torchvision==0.20.1",
        extra_index_url="https://download.pytorch.org/whl/cu124",
    )
    .pip_install(
        "accelerate>=0.31.0",
        "transformers>=4.43.0",
        "peft>=0.12.0",
        "safetensors",
        "fastapi",
        "uvicorn",
        "Pillow>=10.0.0",
        "requests",
        "sentencepiece",
        "protobuf",
        "huggingface_hub>=0.23.0",
    )
    .pip_install(
        "diffusers[torch] @ git+https://github.com/huggingface/diffusers.git",
    )
    .run_commands(
        "python -c 'import torch; print(f\"PyTorch {torch.__version__}, CUDA: {torch.cuda.is_available()}\")'",
        "python -c 'from diffusers import FluxPipeline; print(\"FluxPipeline OK\")'",
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
    container_idle_timeout=120,
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
        print("FLUX.1-dev loaded")
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
        import torch
        import requests
        from pathlib import Path

        try:
            if model_url != self._current_lora_url:
                print(f"Loading LoRA from: {model_url}")
                if self._current_lora_url is not None:
                    self.pipe.unload_lora_weights()

                lora_path = Path("/tmp/current_lora.safetensors")
                resp = requests.get(model_url, timeout=120)
                resp.raise_for_status()
                lora_path.write_bytes(resp.content)
                print(f"   Downloaded: {lora_path.stat().st_size / 1024 / 1024:.1f} MB")

                self.pipe.load_lora_weights(str(lora_path))
                self._current_lora_url = model_url
                print("   LoRA loaded")

            if trigger_word and trigger_word not in prompt:
                prompt = f"{trigger_word} {prompt}"

            if seed < 0:
                seed = torch.randint(0, 2**32, (1,)).item()
            generator = torch.Generator("cuda").manual_seed(seed)

            print(f"Generating: {prompt[:80]}...")

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

            # Upload to Supabase
            supabase_url = os.environ["SUPABASE_URL"]
            supabase_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

            img_buffer = io.BytesIO()
            image.save(img_buffer, format="PNG")
            img_bytes = img_buffer.getvalue()

            file_name = f"{uuid.uuid4().hex}.png"
            upload_url = f"{supabase_url.rstrip('/')}/storage/v1/object/generations/{file_name}"

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
                bucket_url = f"{supabase_url.rstrip('/')}/storage/v1/bucket"
                requests.post(
                    bucket_url,
                    headers={"Authorization": f"Bearer {supabase_key}", "Content-Type": "application/json"},
                    json={"id": "generations", "name": "generations", "public": True},
                    timeout=30,
                )
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

            if upload_resp.status_code in (200, 201):
                public_url = f"{supabase_url.rstrip('/')}/storage/v1/object/public/generations/{file_name}"
                print(f"Uploaded: {public_url}")
                return {"success": True, "image_url": public_url, "seed": seed}
            else:
                print(f"Upload failed: {upload_resp.status_code}")
                img_b64 = base64.b64encode(img_bytes).decode()
                return {"success": True, "image_base64": img_b64, "seed": seed}

        except Exception as e:
            print(f"Generation failed: {e}")
            import traceback
            traceback.print_exc()
            return {"success": False, "error": str(e)}

    @modal.web_endpoint(method="POST", label="carmi-generate-lora")
    def generate_endpoint(self, request: dict) -> dict:
        required = ["prompt", "model_url"]
        for field in required:
            if field not in request:
                return {"success": False, "error": f"Missing: {field}"}

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