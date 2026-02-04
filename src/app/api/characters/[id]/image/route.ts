export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY });

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: characterId } = await params;

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { prompt, aspectRatio = "1:1", numImages = 1 } = await request.json();

        if (!prompt?.trim()) {
            return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
        }

        // Get character
        const { data: character, error: charError } = await supabaseAdmin
            .from("characters")
            .select("*")
            .eq("id", characterId)
            .eq("user_id", user.id)
            .single();

        if (charError || !character) {
            return NextResponse.json({ error: "Character not found" }, { status: 404 });
        }

        // Get LoRA URL
        const loraUrl = character.lora_url || character.model_url;

        if (!loraUrl) {
            return NextResponse.json(
                { error: "Character not trained yet" },
                { status: 400 }
            );
        }

        // Get trigger word
        const settings = typeof character.settings === 'string'
            ? JSON.parse(character.settings)
            : character.settings;
        const triggerWord = character.trigger_word || settings?.trigger_word || "";

        // Build prompt with trigger word
        const fullPrompt = triggerWord ? `${triggerWord}, ${prompt}` : prompt;

        type ImageSize = "square" | "square_hd" | "portrait_4_3" | "portrait_16_9" | "landscape_4_3" | "landscape_16_9";

        // Map aspect ratio to image size
        const imageSizeMap: Record<string, ImageSize> = {
            "1:1": "square",
            "16:9": "landscape_16_9",
            "9:16": "portrait_16_9",
            "4:3": "landscape_4_3",
            "3:4": "portrait_4_3",
        };

        console.log("=== GENERATING IMAGE ===");
        console.log("Character:", character.name);
        console.log("LoRA URL:", loraUrl);
        console.log("Trigger Word:", triggerWord);
        console.log("Full Prompt:", fullPrompt);

        // Use SD 1.5 model (compatible with your Modal-trained LoRA)
        const result = await fal.subscribe("fal-ai/stable-diffusion-v15", {
            input: {
                prompt: fullPrompt,
                negative_prompt: "ugly, blurry, low quality, distorted, deformed",
                loras: [
                    {
                        path: loraUrl,
                        scale: 0.8,
                    },
                ],
                image_size: imageSizeMap[aspectRatio] || "square",
                num_images: Math.min(numImages, 4),
                num_inference_steps: 30,
                guidance_scale: 7.5,
                format: "jpeg",
                enable_safety_checker: false,
            },
            logs: true,
            onQueueUpdate: (update) => {
                if (update.status === "IN_PROGRESS") {
                    update.logs?.map((log) => log.message).forEach(console.log);
                }
            },
        });

        const images = result.data.images?.map((img: any) => img.url) || [];

        if (images.length === 0) {
            throw new Error("No images generated");
        }

        // Save to generations table
        await supabaseAdmin.from("generations").insert({
            user_id: user.id,
            type: "image",
            feature: "character_image",
            prompt: fullPrompt,
            result_urls: images,
            thumbnail_url: images[0],
            character_id: characterId,
            metadata: {
                aspectRatio,
                loraScale: 0.8,
                seed: result.data.seed,
                triggerWord,
                model: "stable-diffusion-v15",
            },
            status: "completed",
        });

        return NextResponse.json({
            success: true,
            images,
            seed: result.data.seed,
        });

    } catch (error: any) {
        console.error("Image generation error:", error);
        return NextResponse.json(
            { error: error.message || "Generation failed" },
            { status: 500 }
        );
    }
}