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

        const { prompt, aspectRatio = "1:1" } = await request.json();

        if (!prompt?.trim()) {
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

        const loraUrl = character.lora_url || character.model_url;

        if (!loraUrl) {
            return NextResponse.json({ error: "Character not trained" }, { status: 400 });
        }

        const triggerWord = character.trigger_word || "";
        const fullPrompt = triggerWord ? `${triggerWord}, ${prompt}` : prompt;

        const imageSizeMap: Record<string, string> = {
            "1:1": "square",
            "16:9": "landscape_16_9",
            "9:16": "portrait_16_9",
        };

        // Create a generation record first
        const { data: generation } = await supabaseAdmin
            .from("generations")
            .insert({
                user_id: user.id,
                type: "image",
                feature: "character_image",
                prompt: fullPrompt,
                character_id: characterId,
                status: "processing",
                metadata: { aspectRatio, loraUrl },
            })
            .select()
            .single();

        // Submit to FAL queue (non-blocking)
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

        if (!response.ok) {
            console.error("FAL Error:", data);
            await supabaseAdmin
                .from("generations")
                .update({ status: "failed", metadata: { error: data } })
                .eq("id", generation?.id);
            return NextResponse.json({ error: data.detail || "FAL error" }, { status: 500 });
        }

        // FAL returns request_id for queue - poll for result
        const requestId = data.request_id;

        // Poll for result (with timeout)
        let result: any = null;
        for (let i = 0; i < 30; i++) {  // 30 attempts, ~30 seconds max
            await new Promise(r => setTimeout(r, 1000));

            const statusRes = await fetch(`https://queue.fal.run/fal-ai/stable-diffusion-v15/requests/${requestId}/status`, {
                headers: { "Authorization": `Key ${process.env.FAL_KEY}` },
            });
            const status = await statusRes.json();

            console.log(`Poll ${i + 1}: ${status.status}`);

            if (status.status === "COMPLETED") {
                // Get the result
                const resultRes = await fetch(`https://queue.fal.run/fal-ai/stable-diffusion-v15/requests/${requestId}`, {
                    headers: { "Authorization": `Key ${process.env.FAL_KEY}` },
                });
                result = await resultRes.json();
                break;
            } else if (status.status === "FAILED") {
                throw new Error("Generation failed");
            }
        }

        if (!result?.images?.[0]?.url) {
            throw new Error("Timeout waiting for image");
        }

        const images = result.images.map((img: any) => img.url);

        // Update generation record
        await supabaseAdmin
            .from("generations")
            .update({
                status: "completed",
                result_urls: images,
                thumbnail_url: images[0],
            })
            .eq("id", generation?.id);

        return NextResponse.json({ success: true, images });

    } catch (error: any) {
        console.error("Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}