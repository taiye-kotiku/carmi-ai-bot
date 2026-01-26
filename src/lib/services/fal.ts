// src/lib/services/fal.ts
import { fal } from "@fal-ai/client";

// Configure fal client
fal.config({
    credentials: process.env.FAL_KEY,
});

// Download image helper
export async function downloadImage(url: string): Promise<Buffer> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

// Generate image with fal.ai
export async function generateImage(options: {
    prompt: string;
    model?: string;
    aspectRatio?: string;
    negativePrompt?: string;
}) {
    const {
        prompt,
        model = "fal-ai/flux/schnell",
        aspectRatio = "9:16",
        negativePrompt,
    } = options;

    const result = await fal.subscribe(model, {
        input: {
            prompt,
            image_size: aspectRatio === "9:16" ? "portrait_16_9"
                : aspectRatio === "16:9" ? "landscape_16_9"
                    : aspectRatio === "1:1" ? "square"
                        : "portrait_4_3",
            negative_prompt: negativePrompt,
            num_images: 1,
        },
    });

    return {
        images: result.data?.images?.map((img: any) => img.url) || [],
        seed: result.data?.seed,
    };
}

// Generate with character reference (PuLID/IP-Adapter)
export async function generateWithCharacter(options: {
    prompt: string;
    referenceImages: string[];
    model?: string;
    aspectRatio?: string;
    ipAdapterScale?: number;
}) {
    const {
        prompt,
        referenceImages,
        model = "fal-ai/pulid",
        aspectRatio = "9:16",
        ipAdapterScale = 0.8,
    } = options;

    const result = await fal.subscribe(model, {
        input: {
            prompt,
            reference_images: referenceImages.map(url => ({ url })),
            image_size: aspectRatio === "9:16" ? "portrait_16_9"
                : aspectRatio === "16:9" ? "landscape_16_9"
                    : aspectRatio === "1:1" ? "square"
                        : "portrait_4_3",
            ip_adapter_scale: ipAdapterScale,
            num_images: 1,
        },
    });

    return {
        images: result.data?.images?.map((img: any) => img.url) || [],
        seed: result.data?.seed,
    };
}

// Image to video (if needed)
export async function imageToVideo(options: {
    imageUrl: string;
    motion?: string;
    duration?: number;
}) {
    const { imageUrl, motion = "auto", duration = 5 } = options;

    const result = await fal.subscribe("fal-ai/runway/gen3/turbo/image-to-video", {
        input: {
            image_url: imageUrl,
            duration,
        },
    });

    return {
        videoUrl: result.data?.video?.url,
    };
}