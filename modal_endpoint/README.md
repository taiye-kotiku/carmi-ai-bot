# Modal FLUX.1-dev LoRA Training

This endpoint trains LoRA adapters on FLUX.1-dev for character consistency, then uploads the safetensors to Supabase and calls the webhook.

## Setup

1. **Modal account** – Sign up at [modal.com](https://modal.com)

2. **Hugging Face token** – Required for FLUX.1-dev (gated model). Create a secret:
   ```bash
   modal secret create huggingface-secret HF_TOKEN=your_hf_token
   ```

3. **Deploy the app**:
   ```bash
   cd modal_endpoint
   modal deploy train_lora.py
   ```

4. **Copy the endpoint URL** – After deploy, Modal shows a URL like `https://xxx--carmi-flux-lora-training-start-training.modal.run`. Add it to `.env.local`:
   ```
   MODAL_TRAIN_ENDPOINT_URL=https://xxx--carmi-flux-lora-training-start-training.modal.run
   ```

## Supabase Storage

Create a bucket named `loras` (public) so the trained LoRA can be stored and served:

- In Supabase Dashboard → Storage → New bucket: `loras`
- Enable public access for the bucket or configure RLS as needed

## Flow

1. User clicks "התחל אימון" on a character with ≥15 reference images
2. Next.js calls `MODAL_TRAIN_ENDPOINT_URL` with character_id, name, reference_image_urls, webhook_url, Supabase credentials
3. Modal downloads images, runs diffusers `train_dreambooth_lora_flux.py` on FLUX.1-dev
4. Output `pytorch_lora_weights.safetensors` is uploaded to `loras/{character_id}/lora.safetensors`
5. Webhook `{APP_URL}/api/webhooks/training-complete` is called with model_url, trigger_word, status
6. Character is marked `ready` and can be used with Fal.ai flux-lora for image generation
