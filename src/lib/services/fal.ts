// src/lib/services/fal.ts
import * as fal from "@fal-ai/serverless-client";

fal.config({
    credentials: process.env.FAL_KEY!,
});

export type ConsistencyModel = "pulid" | "ip-adapter" | "instantid";

interface GenerateWithCharacterOptions {
    prompt: string;
    referenceImages: string[];
    model?: ConsistencyModel;
    negativePrompt?: string;
    aspectRatio?: string;
    ipAdapterScale?: number;
}

interface FalImage {
    url: string;
    width: number;
    height: number;
}

interface FalResult {
    images: FalImage[];
    seed?: number;
}

export async function generateWithCharacter(
    options: GenerateWithCharacterOptions
): Promise<{ images: string[]; seed?: number }> {
    const {
        prompt,
        referenceImages,
        model = "pulid",
        negativePrompt = "ugly, blurry, low quality, distorted",
        aspectRatio = "1:1",
        ipAdapterScale = 0.8,
    } = options;

    const imageSize = getImageSize(aspectRatio);

    let result: FalResult;

    switch (model) {
        case "pulid":
            // Best for face consistency
            result = await fal.subscribe("fal-ai/pulid", {
                input: {
                    prompt,
                    reference_images: referenceImages.map((url) => ({ url })),
                    negative_prompt: negativePrompt,
                    num_images: 1,
                    id_scale: ipAdapterScale,
                    mode: "fidelity",
                    ...imageSize,
                },
                logs: true,
            });
            break;

        case "ip-adapter":
            // Good for style + character
            result = await fal.subscribe("fal-ai/flux/dev/ip-adapter", {
                input: {
                    prompt,
                    ip_adapter_images: referenceImages.map((url) => ({ url })),
                    negative_prompt: negativePrompt,
                    num_images: 1,
                    ip_adapter_scale: ipAdapterScale,
                    ...imageSize,
                },
                logs: true,
            });
            break;

        case "instantid":
            // Fastest, single reference
            result = await fal.subscribe("fal-ai/instantid", {
                input: {
                    prompt,
                    face_image_url: referenceImages[0],
                    negative_prompt: negativePrompt,
                    num_images: 1,
                    ip_adapter_scale: ipAdapterScale,
                },
                logs: true,
            });
            break;

        default:
            throw new Error(`Unknown model: ${model}`);
    }

    return {
        images: result.images.map((img) => img.url),
        seed: result.seed,
    };
}

function getImageSize(aspectRatio: string): { width: number; height: number } {
    const sizes: Record<string, { width: number; height: number }> = {
        "1:1": { width: 1024, height: 1024 },
        "16:9": { width: 1344, height: 768 },
        "9:16": { width: 768, height: 1344 },
        "4:3": { width: 1152, height: 896 },
    };
    return sizes[aspectRatio] || sizes["1:1"];
}

// Helper to download image and convert to buffer for storage
export async function downloadImage(url: string): Promise<Buffer> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}