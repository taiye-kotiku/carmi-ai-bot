export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

        if (!prompt) {
            return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
        }

        // Get character
        const { data: character } = await supabaseAdmin
            .from("characters")
            .select("*")
            .eq("id", characterId)
            .eq("user_id", user.id)
            .single();

        if (!character) {
            return NextResponse.json({ error: "Character not found" }, { status: 404 });
        }

        if (character.status !== "ready" || !character.lora_url) {
            return NextResponse.json({ error: "הדמות עוד לא מאומנת" }, { status: 400 });
        }

        // Build prompt with trigger word
        const fullPrompt = character.trigger_word
            ? `${character.trigger_word} ${prompt}`
            : prompt;

        // Map aspect ratio to FAL format
        const sizeMap: Record<string, string> = {
            "1:1": "square",
            "16:9": "landscape_16_9",
            "9:16": "portrait_16_9",
            "4:3": "landscape_4_3",
            "3:4": "portrait_4_3",
        };

        console.log("=== Generating Character Image ===");
        console.log("Prompt:", fullPrompt);
        console.log("LoRA:", character.lora_url);
        console.log("Aspect:", aspectRatio);

        // Call FAL Flux LoRA
        const response = await fetch("https://fal.run/fal-ai/flux-lora", {
            method: "POST",
            headers: {
                "Authorization": `Key ${process.env.FAL_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                prompt: fullPrompt,
                loras: [{ path: character.lora_url, scale: 1 }],
                image_size: sizeMap[aspectRatio] || "square",
                num_images: Math.min(numImages, 4),
                output_format: "jpeg",
                guidance_scale: 3.5,
                num_inference_steps: 28,
                enable_safety_checker: false,
            }),
        });

        const result = await response.json();
        console.log("FAL Result:", JSON.stringify(result, null, 2));

        if (!response.ok) {
            throw new Error(result.detail || "Image generation failed");
        }

        const images = result.images?.map((img: any) => img.url) || [];

        if (images.length === 0) {
            throw new Error("No images generated");
        }

        // Save to generations
        const generationId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await supabaseAdmin
            .from("generations")
            .insert({
                id: generationId,
                user_id: user.id,
                type: "image",
                feature: "character_image",
                prompt: fullPrompt,
                character_id: characterId,
                status: "completed",
                result_urls: images,
                thumbnail_url: images[0],
            });

        return NextResponse.json({
            success: true,
            images,
            generationId,
        });

    } catch (error: any) {
        console.error("Image generation error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}