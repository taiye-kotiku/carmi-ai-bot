// src/lib/services/modal.ts
const MODAL_TRAINING_URL = process.env.MODAL_TRAINING_URL;
const MODAL_INFERENCE_URL = process.env.MODAL_INFERENCE_URL;

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
        throw new Error("MODAL_TRAINING_URL environment variable is not set");
    }

    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/training-complete`;

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

    console.log("[Modal] Calling:", MODAL_TRAINING_URL);
    console.log("[Modal] Body:", JSON.stringify({
        ...body,
        reference_image_urls: `[${body.reference_image_urls.length} urls]`,
    }));

    try {
        const response = await fetch(MODAL_TRAINING_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        console.log("[Modal] Response status:", response.status);

        const responseText = await response.text();
        console.log("[Modal] Response body:", responseText.slice(0, 500));

        if (!response.ok) {
            throw new Error(
                `Modal returned ${response.status}: ${responseText.slice(0, 200)}`
            );
        }

        try {
            return JSON.parse(responseText);
        } catch {
            throw new Error(`Modal returned non-JSON: ${responseText.slice(0, 200)}`);
        }
    } catch (fetchError) {
        if (fetchError instanceof Error) {
            console.error("[Modal] Fetch error:", fetchError.message);
            throw fetchError;
        }
        throw new Error(`Modal fetch failed: ${String(fetchError)}`);
    }
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
        throw new Error("MODAL_INFERENCE_URL environment variable is not set");
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

    console.log("[Modal] Generating:", MODAL_INFERENCE_URL);
    console.log("[Modal] Prompt:", params.prompt.slice(0, 80));

    const response = await fetch(MODAL_INFERENCE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    console.log("[Modal] Inference status:", response.status);

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Modal inference ${response.status}: ${errorText.slice(0, 200)}`);
    }

    return response.json();
}