export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY });

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { characterId, prompt, aspectRatio = "1:1" } = await request.json();

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

        const triggerWord = (character.settings as any)?.trigger_word || "TOK";
        // Build prompt with trigger word
        const fullPrompt = `${triggerWord} ${prompt}`;

        // Generate with FLUX + LoRA
        const result = await fal.subscribe("fal-ai/flux-lora", {
            input: {
                prompt: fullPrompt,
                loras: [
                    {
                        path: character.lora_url,
                        scale: 0.9,
                    },
                ],
                image_size: aspectRatio === "9:16" ? "portrait_16_9" :
                    aspectRatio === "16:9" ? "landscape_16_9" : "square",
                num_images: 1,
                output_format: "jpeg",
                guidance_scale: 3.5,
                num_inference_steps: 28,
                enable_safety_checker: false,
            },
        });

        const imageUrl = result.data.images[0].url;

        // Save to generations table
        const generationId = crypto.randomUUID();
        await supabaseAdmin.from("generations").insert({
            id: generationId,
            user_id: user.id,
            type: "image",
            feature: "character_image",
            prompt: fullPrompt,
            result_urls: [imageUrl],
            status: "completed",
        });
        return NextResponse.json({
            success: true,
            imageUrl,
        });
    } catch (error: any) {
        console.error("Character image generation error:", error);
        return NextResponse.json(
            { error: error.message || "Generation failed" },
            { status: 500 }
        );
    }
}