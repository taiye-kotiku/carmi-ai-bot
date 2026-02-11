export const runtime = "nodejs";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fal } from "@fal-ai/client";
import { deductCredits, addCredits } from "@/lib/services/credits";
import { CREDIT_COSTS } from "@/lib/config/credits";

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
            imageUrl,
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

        // Deduct credits upfront (atomic check + deduction)
        try {
            await deductCredits(user.id, "video_generation");
        } catch (err) {
            return NextResponse.json(
                {
                    error: (err as Error).message,
                    code: "INSUFFICIENT_CREDITS",
                },
                { status: 402 }
            );
        }

        try {
            let sourceImageUrl = imageUrl;

            // If no image provided, generate one first
            if (!sourceImageUrl && character.lora_url) {
                const triggerWord = character.trigger_word || "TOK";
                const imageResult = await fal.subscribe("fal-ai/flux-lora", {
                    input: {
                        prompt: `${triggerWord} ${prompt}`,
                        loras: [{ path: character.lora_url, scale: 0.9 }],
                        image_size: aspectRatio === "9:16" ? "portrait_16_9" : "landscape_16_9",
                        num_images: 1,
                    },
                });
                sourceImageUrl = imageResult.data.images[0].url;
            }

            if (!sourceImageUrl) {
                throw new Error("No image available for video");
            }

            const triggerWord = character.trigger_word || "TOK";
            const validDuration = (String(duration) === "10" ? "10" : "5") as "5" | "10";

            const videoResult = await fal.subscribe("fal-ai/kling-video/v1.5/pro/image-to-video", {
                input: {
                    prompt: `${triggerWord} ${prompt}`,
                    image_url: sourceImageUrl,
                    duration: validDuration,
                    aspect_ratio: aspectRatio,
                },
            });

            const videoUrl = videoResult.data.video.url;

            // Save to generations
            const generationId = crypto.randomUUID();
            await supabaseAdmin.from("generations").insert({
                id: generationId,
                user_id: user.id,
                type: "video",
                feature: "character_video",
                prompt: prompt,
                result_urls: [videoUrl],
                source_url: sourceImageUrl,
                status: "completed",
            });

            return NextResponse.json({
                success: true,
                videoUrl,
                sourceImageUrl,
            });

        } catch (genError: any) {
            console.error("Character video generation error:", genError);

            // Refund credits on failure
            await addCredits(
                user.id,
                CREDIT_COSTS.video_generation,
                "החזר - יצירת וידאו דמות נכשלה"
            );

            return NextResponse.json(
                { error: genError.message || "Video generation failed" },
                { status: 500 }
            );
        }

    } catch (error: any) {
        console.error("Character video error:", error);
        return NextResponse.json(
            { error: error.message || "Video generation failed" },
            { status: 500 }
        );
    }
}