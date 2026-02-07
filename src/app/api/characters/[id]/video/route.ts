export const maxDuration = 120;

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

        const { prompt, aspectRatio = "16:9" } = await request.json();

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

        if (character.model_status !== "ready" || !character.model_url) {
            return NextResponse.json({ error: "הדמות עוד לא מאומנת" }, { status: 400 });
        }

        const triggerWord = (character.settings as any)?.trigger_word;
        const fullPrompt = triggerWord
            ? `${triggerWord} ${prompt}`
            : prompt;

        const sizeMap: Record<string, string> = {
            "16:9": "landscape_16_9",
            "9:16": "portrait_16_9",
            "1:1": "square",
        };

        console.log("=== Step 1: Generating Character Image ===");

        // Step 1: Generate image with LoRA
        const imageRes = await fetch("https://fal.run/fal-ai/flux-lora", {
            method: "POST",
            headers: {
                "Authorization": `Key ${process.env.FAL_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                prompt: fullPrompt,
                loras: [{ path: character.model_url, scale: 1 }],
                image_size: sizeMap[aspectRatio] || "landscape_16_9",
                num_images: 1,
                guidance_scale: 3.5,
                num_inference_steps: 28,
            }),
        });

        const imageData = await imageRes.json();

        if (!imageData.images?.[0]?.url) {
            throw new Error("Failed to generate character image");
        }

        const imageUrl = imageData.images[0].url;
        console.log("Image generated:", imageUrl);

        console.log("=== Step 2: Generating Video from Image ===");

        // Step 2: Image to video with Kling
        const videoRes = await fetch("https://queue.fal.run/fal-ai/kling-video/v1.5/pro/image-to-video", {
            method: "POST",
            headers: {
                "Authorization": `Key ${process.env.FAL_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                prompt: prompt,
                image_url: imageUrl,
                duration: "5",
                aspect_ratio: aspectRatio,
            }),
        });

        const videoData = await videoRes.json();
        console.log("Video job:", videoData);

        if (!videoData.request_id) {
            throw new Error("Failed to start video generation");
        }

        // Save to generations
        const generationId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await supabaseAdmin
            .from("generations")
            .insert({
                id: generationId,
                user_id: user.id,
                type: "video",
                feature: "character_video",
                prompt: fullPrompt,
                character_id: characterId,
                status: "processing",
                job_id: videoData.request_id,
                source_url: imageUrl,
            });

        return NextResponse.json({
            success: true,
            generationId,
            imageUrl,
            status: "processing",
        });

    } catch (error: any) {
        console.error("Video generation error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}