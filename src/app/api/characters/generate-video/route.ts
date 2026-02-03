export const runtime = "nodejs";
export const maxDuration = 300;

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

        const {
            characterId,
            prompt,
            imageUrl, // Optional: use existing character image
            aspectRatio = "16:9",
            duration = 5
        } = await request.json();

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

        let sourceImageUrl = imageUrl;

        // If no image provided, generate one first
        if (!sourceImageUrl && character.lora_url) {
            const imageResult = await fal.subscribe("fal-ai/flux-lora", {
                input: {
                    prompt: `${character.trigger_word} ${prompt}`,
                    loras: [{ path: character.lora_url, scale: 0.9 }],
                    image_size: aspectRatio === "9:16" ? "portrait_16_9" : "landscape_16_9",
                    num_images: 1,
                },
            });
            sourceImageUrl = imageResult.data.images[0].url;
        }

        if (!sourceImageUrl) {
            return NextResponse.json(
                { error: "No image available for video" },
                { status: 400 }
            );
        }

        // Generate video from image using Kling
        const validDuration = (String(duration) === "10" ? "10" : "5") as "5" | "10";

        const videoResult = await fal.subscribe("fal-ai/kling-video/v1.5/pro/image-to-video", {
            input: {
                prompt: `${character.trigger_word} ${prompt}`,
                image_url: sourceImageUrl,
                duration: validDuration,
                aspect_ratio: aspectRatio,
            },
        });

        const videoUrl = videoResult.data.video.url;

        // Save to generations
        await supabaseAdmin.from("generations").insert({
            user_id: user.id,
            type: "video",
            prompt,
            result_url: videoUrl,
            character_id: characterId,
            metadata: { aspectRatio, duration, sourceImageUrl },
        });

        return NextResponse.json({
            success: true,
            videoUrl,
            sourceImageUrl,
        });
    } catch (error: any) {
        console.error("Character video generation error:", error);
        return NextResponse.json(
            { error: error.message || "Video generation failed" },
            { status: 500 }
        );
    }
}