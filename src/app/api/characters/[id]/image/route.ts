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

        console.log("Submitting to FAL...");
        console.log("LoRA URL:", loraUrl);
        console.log("Prompt:", fullPrompt);

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

        const falData = await response.json();
        console.log("FAL Response:", JSON.stringify(falData, null, 2));

        if (!response.ok) {
            console.error("FAL Error:", falData);
            return NextResponse.json({
                error: falData.detail || falData.message || "FAL error"
            }, { status: 500 });
        }

        // Generate unique ID
        const generationId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

        // Create generation record
        const { error: dbError } = await supabaseAdmin
            .from("generations")
            .insert({
                id: generationId,
                user_id: user.id,
                type: "image",
                feature: "character_image",
                prompt: fullPrompt,
                character_id: characterId,
                status: "processing",
                job_id: falData.request_id,  // Store FAL request ID here
            });

        if (dbError) {
            console.error("DB Error:", dbError);
            return NextResponse.json({ error: "Database error: " + dbError.message }, { status: 500 });
        }

        console.log("Created generation:", generationId);

        return NextResponse.json({
            success: true,
            generationId: generationId,
            status: "processing"
        });

    } catch (error: any) {
        console.error("Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}