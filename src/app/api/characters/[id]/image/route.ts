export const maxDuration = 30;

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

        const { prompt, aspectRatio = "1:1" } = await request.json();

        const { data: character } = await supabaseAdmin
            .from("characters")
            .select("*")
            .eq("id", characterId)
            .eq("user_id", user.id)
            .single();

        if (!character) {
            return NextResponse.json({ error: "Character not found" }, { status: 404 });
        }

        const loraUrl = character.lora_url || character.model_url;
        if (!loraUrl) {
            return NextResponse.json({ error: "Not trained" }, { status: 400 });
        }

        const triggerWord = character.trigger_word || "";
        const fullPrompt = triggerWord ? `${triggerWord}, ${prompt}` : prompt;

        const imageSizeMap: Record<string, string> = {
            "1:1": "square",
            "16:9": "landscape_16_9",
            "9:16": "portrait_16_9",
        };

        // Submit to FAL
        const response = await fetch("https://queue.fal.run/fal-ai/stable-diffusion-v15", {
            method: "POST",
            headers: {
                "Authorization": `Key ${process.env.FAL_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                prompt: fullPrompt,
                negative_prompt: "ugly, blurry, low quality, distorted",
                loras: [{ path: loraUrl, scale: 0.8 }],
                image_size: imageSizeMap[aspectRatio] || "square",
                num_images: 1,
                num_inference_steps: 20,
                guidance_scale: 7.5,
                enable_safety_checker: false,
            }),
        });

        const data = await response.json();
        console.log("FAL Submit Response:", data);

        if (!response.ok) {
            return NextResponse.json({ error: data.detail || "FAL error" }, { status: 500 });
        }

        // Save generation with FAL request ID
        const { data: generation } = await supabaseAdmin
            .from("generations")
            .insert({
                user_id: user.id,
                type: "image",
                feature: "character_image",
                prompt: fullPrompt,
                character_id: characterId,
                status: "processing",
                metadata: {
                    fal_request_id: data.request_id,
                    aspectRatio,
                    loraUrl
                },
            })
            .select()
            .single();

        // Return immediately
        return NextResponse.json({
            success: true,
            generationId: generation?.id,
            status: "processing"
        });

    } catch (error: any) {
        console.error("Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}