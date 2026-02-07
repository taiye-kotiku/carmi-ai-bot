// src/lib/services/modal.ts
/**
 * Modal API client for FLUX LoRA training and inference.
 */

const MODAL_TRAINING_URL =
    process.env.MODAL_TRAINING_URL || process.env.MODAL_TRAIN_ENDPOINT_URL;
const MODAL_INFERENCE_URL = process.env.MODAL_INFERENCE_URL;

// ─── Training ───

interface StartTrainingParams {
    characterId: string;
    characterName: string;
    referenceImageUrls: string[];
    numTrainSteps?: number;
    learningRate?: number;
    loraRank?: number;
    resolution?: number;
}

interface ModalTrainingResponse {
    success: boolean;
    message?: string;
    character_id?: string;
    errors?: string[];
    config?: {
        num_images: number;
        num_train_steps: number;
        resolution: number;
        lora_rank: number;
    };
}

export async function startLoraTraining(
    params: StartTrainingParams
): Promise<ModalTrainingResponse> {
    if (!MODAL_TRAINING_URL) {
        throw new Error(
            "MODAL_TRAINING_URL or MODAL_TRAIN_ENDPOINT_URL is not configured. " +
                "Set it in Vercel/env to your Modal web endpoint URL."
        );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
        throw new Error(
            "NEXT_PUBLIC_APP_URL is not set. Required for webhook callbacks."
        );
    }
    const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/webhooks/training-complete`;

    const body = {
        character_id: params.characterId,
        character_name: params.characterName,
        reference_image_urls: params.referenceImageUrls,
        webhook_url: webhookUrl,
        num_train_steps: params.numTrainSteps ?? 800,
        learning_rate: params.learningRate ?? 1e-4,
        lora_rank: params.loraRank ?? 16,
        resolution: params.resolution ?? 1024,
    };

    console.log("[Modal] Starting training:", {
        character_id: params.characterId,
        character_name: params.characterName,
        num_images: params.referenceImageUrls.length,
        webhook_url: webhookUrl,
    });

    const response = await fetch(MODAL_TRAINING_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("[Modal] Training request failed:", response.status, errorText);
        throw new Error(`Modal training request failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log("[Modal] Training response:", result);
    return result;
}

// ─── Inference ───

interface GenerateWithLoraParams {
    prompt: string;
    modelUrl: string;
    triggerWord: string;
    negativePrompt?: string;
    numInferenceSteps?: number;
    guidanceScale?: number;
    width?: number;
    height?: number;
    seed?: number;
    loraScale?: number;
}

interface ModalGenerationResult {
    success: boolean;
    image_url?: string;
    image_base64?: string;
    seed?: number;
    error?: string;
}

export async function generateWithLora(
    params: GenerateWithLoraParams
): Promise<ModalGenerationResult> {
    if (!MODAL_INFERENCE_URL) {
        throw new Error("MODAL_INFERENCE_URL is not configured");
    }

    const body = {
        prompt: params.prompt,
        model_url: params.modelUrl,
        trigger_word: params.triggerWord,
        negative_prompt: params.negativePrompt ?? "",
        num_inference_steps: params.numInferenceSteps ?? 28,
        guidance_scale: params.guidanceScale ?? 3.5,
        width: params.width ?? 1024,
        height: params.height ?? 1024,
        seed: params.seed ?? -1,
        lora_scale: params.loraScale ?? 0.85,
    };

    console.log("[Modal] Generating image:", {
        prompt: params.prompt.slice(0, 80),
        model_url: params.modelUrl.slice(0, 60) + "...",
        trigger_word: params.triggerWord,
    });

    const response = await fetch(MODAL_INFERENCE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("[Modal] Inference failed:", response.status, errorText);
        throw new Error(`Modal inference failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log("[Modal] Generation result:", {
        success: result.success,
        has_url: !!result.image_url,
        seed: result.seed,
    });
    return result;
}