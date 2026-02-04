export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY });

type ImageSize = "square" | "square_hd" | "portrait_4_3" | "portrait_16_9" | "landscape_4_3" | "landscape_16_9";

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

        // Get character with LoRA
        const { data: character, error: charError } = await supabaseAdmin
            .from("characters")
            .select("*")
            .eq("id", characterId)
            .eq("user_id", user.id)
            .single();

        if (charError || !character) {
            return NextResponse.json({ error: "Character not found" }, { status: 404 });
        }

        if (!character.lora_url) {
            return NextResponse.json(
                { error: "Character not trained yet" },
                { status: 400 }
            );
        }

        // Build prompt with trigger word
        const fullPrompt = character.trigger_word
            ? `${character.trigger_word}, ${prompt}`
            : prompt;

        // Map aspect ratio to image size
        const imageSizeMap: Record<string, ImageSize> = {
            "1:1": "square",
            "16:9": "landscape_16_9",
            "9:16": "portrait_16_9",
            "4:3": "landscape_4_3",
            "3:4": "portrait_4_3",
        };

        console.log("=== CHARACTER IMAGE ===");
        console.log("Character:", character.name);
        console.log("LoRA:", character.lora_url);
        console.log("Prompt:", fullPrompt);

        // Generate with FLUX + LoRA (SYNCHRONOUS - waits for result)
        const result = await fal.subscribe("fal-ai/flux-lora", {
            input: {
                prompt: fullPrompt,
                loras: [
                    {
                        path: character.lora_url,
                        scale: 0.9,
                    },
                ],
                image_size: imageSizeMap[aspectRatio] || "square",
                num_images: Math.min(numImages, 4),
                output_format: "jpeg",
                guidance_scale: 3.5,
                num_inference_steps: 28,
                enable_safety_checker: false,
            },
            logs: true,
            onQueueUpdate: (update) => {
                if (update.status === "IN_PROGRESS") {
                    console.log("FAL progress:", update.logs?.map(l => l.message).join(", "));
                }
            },
        });

        const images = result.data.images?.map((img: any) => img.url) || [];

        if (images.length === 0) {
            throw new Error("No images generated");
        }

        console.log("Generated", images.length, "images");

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
                loraScale: 0.9,
                seed: result.data.seed,
            },
            status: "completed",
        });

        return NextResponse.json({
            success: true,
            images,
            seed: result.data.seed,
        });

    } catch (error: any) {
        console.error("Character image error:", error);
        return NextResponse.json(
            { error: error.message || "Generation failed" },
            { status: 500 }
        );
    }
}