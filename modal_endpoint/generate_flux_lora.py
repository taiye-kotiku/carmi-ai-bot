# modal_endpoint/generate_flux_lora.py - FIXED VERSION
"""
Modal FLUX.1-dev inference with LoRA - Fixed for PEFT format.
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
        print("FLUX.1-dev loaded successfully!")
        
        self._current_lora_url = None
        self._lora_loaded = False

    def _load_lora(self, model_url: str, lora_scale: float = 1.0):
        """Load LoRA weights - completely rebuilt for PEFT compatibility."""
        import torch
        import requests
        from pathlib import Path
        from safetensors.torch import load_file

        if model_url == self._current_lora_url and self._lora_loaded:
            print(f"   LoRA already loaded from {model_url[:50]}...")
            return True

        print(f"\n{'='*50}")
        print(f"Loading LoRA from: {model_url}")
        print(f"{'='*50}")

        # Unload any existing LoRA/adapters
        if self._lora_loaded:
            try:
                # Try multiple unload methods
                if hasattr(self.pipe.transformer, 'disable_adapters'):
                    self.pipe.transformer.disable_adapters()
                if hasattr(self.pipe.transformer, 'delete_adapter'):
                    try:
                        self.pipe.transformer.delete_adapter("character")
                    except:
                        pass
                if hasattr(self.pipe, 'unload_lora_weights'):
                    try:
                        self.pipe.unload_lora_weights()
                    except:
                        pass
                print("   Previous LoRA unloaded")
            except Exception as e:
                print(f"   Warning: Could not fully unload previous LoRA: {e}")

        # Download LoRA file
        lora_path = Path("/tmp/current_lora.safetensors")
        resp = requests.get(model_url, timeout=120)
        resp.raise_for_status()
        lora_path.write_bytes(resp.content)
        file_size = lora_path.stat().st_size / (1024 * 1024)
        print(f"   Downloaded: {file_size:.1f} MB")

        # Load and inspect state dict
        state_dict = load_file(str(lora_path))
        print(f"   Total tensors: {len(state_dict)}")
        
        # Show sample keys
        sample_keys = list(state_dict.keys())[:5]
        print(f"   Sample keys:")
        for k in sample_keys:
            print(f"      - {k}: {state_dict[k].shape}")

        # Detect LoRA format
        has_lora_keys = any("lora_A" in k or "lora_B" in k for k in state_dict.keys())
        
        if not has_lora_keys:
            print("   ERROR: No LoRA keys found in state dict!")
            self._lora_loaded = False
            return False

        print("   Detected PEFT-style LoRA weights")

        # Determine rank from weights
        lora_rank = 64  # default
        for key in state_dict.keys():
            if "lora_A" in key and "weight" in key:
                lora_rank = state_dict[key].shape[0]
                print(f"   Detected LoRA rank: {lora_rank}")
                break

        # Import PEFT
        from peft import LoraConfig, set_peft_model_state_dict, get_peft_model

        # Create LoRA config matching training exactly
        lora_config = LoraConfig(
            r=lora_rank,
            lora_alpha=lora_rank,  # Same as training
            target_modules=[
                "to_q", "to_k", "to_v", "to_out.0",
                "add_q_proj", "add_k_proj", "add_v_proj", "to_add_out",
                "proj_out",
            ],
            lora_dropout=0.0,
            init_lora_weights=True,
        )

        try:
            # Method 1: Add adapter directly to transformer
            print("   Adding LoRA adapter to transformer...")
            self.pipe.transformer.add_adapter(lora_config, adapter_name="character")
            
            # Prepare state dict with correct key format
            peft_state_dict = {}
            for key, value in state_dict.items():
                # PEFT expects keys with 'base_model.model.' prefix
                if key.startswith("base_model.model."):
                    new_key = key
                else:
                    new_key = f"base_model.model.{key}"
                peft_state_dict[new_key] = value.to(torch.bfloat16)
            
            print(f"   Prepared {len(peft_state_dict)} tensors for loading")
            
            # Load the weights
            incompatible = set_peft_model_state_dict(
                self.pipe.transformer, 
                peft_state_dict, 
                adapter_name="character"
            )
            
            if incompatible:
                print(f"   Warning - incompatible keys: {incompatible}")
            
            # Enable the adapter
            self.pipe.transformer.set_adapter("character")
            self.pipe.transformer.enable_adapters()
            
            # Verify it's active
            active = getattr(self.pipe.transformer, 'active_adapters', [])
            print(f"   Active adapters: {active}")
            
            self._current_lora_url = model_url
            self._lora_loaded = True
            print("   ✅ LoRA loaded and activated successfully!")
            return True

        except Exception as e:
            print(f"   ❌ PEFT loading failed: {e}")
            import traceback
            traceback.print_exc()
            
            # Fallback: Try direct state dict injection
            print("   Attempting fallback method...")
            try:
                # Reset transformer
                self.pipe.transformer = self.pipe.transformer.base_model.model
                self.pipe.transformer.add_adapter(lora_config, adapter_name="character")
                set_peft_model_state_dict(self.pipe.transformer, peft_state_dict, adapter_name="character")
                self.pipe.transformer.set_adapter("character")
                self.pipe.transformer.enable_adapters()
                
                self._current_lora_url = model_url
                self._lora_loaded = True
                print("   ✅ Fallback method succeeded!")
                return True
            except Exception as e2:
                print(f"   ❌ Fallback also failed: {e2}")
                self._lora_loaded = False
                return False

    def _generate_image(
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
        lora_scale: float = 1.0,
    ) -> dict:
        import torch
        import requests

        try:
            # Load LoRA
            lora_success = self._load_lora(model_url, lora_scale)
            
            if not lora_success:
                return {"success": False, "error": "Failed to load LoRA weights"}

            # Verify LoRA is active before generation
            print(f"\n{'='*50}")
            print("Pre-generation check:")
            active_adapters = getattr(self.pipe.transformer, 'active_adapters', None)
            print(f"   Active adapters: {active_adapters}")
            print(f"   LoRA loaded: {self._lora_loaded}")
            
            # Check if any LoRA layers have non-zero weights
            lora_weight_sum = 0
            for name, param in self.pipe.transformer.named_parameters():
                if "lora" in name.lower():
                    lora_weight_sum += param.abs().sum().item()
            print(f"   LoRA weights sum: {lora_weight_sum:.2f}")
            
            if lora_weight_sum < 1.0:
                print("   ⚠️ WARNING: LoRA weights appear to be zero or very small!")
            print(f"{'='*50}\n")

            # Build prompt with trigger word
            if trigger_word and trigger_word.lower() not in prompt.lower():
                prompt = f"{trigger_word} {prompt}"
            
            print(f"Generating with prompt: {prompt[:100]}...")

            # Handle seed
            if seed < 0:
                seed = torch.randint(0, 2**32, (1,)).item()
            generator = torch.Generator("cuda").manual_seed(seed)

            # Generate image
            # Note: For PEFT adapters, we don't use joint_attention_kwargs
            # The adapter is already applied to the model
            result = self.pipe(
                prompt=prompt,
                num_inference_steps=num_inference_steps,
                guidance_scale=guidance_scale,
                width=width,
                height=height,
                generator=generator,
                # Don't use joint_attention_kwargs with PEFT adapters
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
                    headers={
                        "Authorization": f"Bearer {supabase_key}",
                        "Content-Type": "application/json"
                    },
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
                print(f"✅ Uploaded: {public_url}")
                return {"success": True, "image_url": public_url, "seed": seed}
            else:
                print(f"Upload failed: {upload_resp.status_code}")
                img_b64 = base64.b64encode(img_bytes).decode()
                return {"success": True, "image_base64": img_b64, "seed": seed}

        except Exception as e:
            print(f"❌ Generation failed: {e}")
            import traceback
            traceback.print_exc()
            return {"success": False, "error": str(e)}

    @modal.method()
    def generate(self, **kwargs) -> dict:
        return self._generate_image(**kwargs)

    @modal.web_endpoint(method="POST", label="carmi-generate-lora")
    def generate_endpoint(self, request: dict) -> dict:
        required = ["prompt", "model_url"]
        for field in required:
            if field not in request:
                return {"success": False, "error": f"Missing: {field}"}

        return self._generate_image(
            prompt=request["prompt"],
            model_url=request["model_url"],
            trigger_word=request.get("trigger_word", "TOK"),
            negative_prompt=request.get("negative_prompt", ""),
            num_inference_steps=request.get("num_inference_steps", 28),
            guidance_scale=request.get("guidance_scale", 3.5),
            width=request.get("width", 1024),
            height=request.get("height", 1024),
            seed=request.get("seed", -1),
            lora_scale=request.get("lora_scale", 1.0),
        )