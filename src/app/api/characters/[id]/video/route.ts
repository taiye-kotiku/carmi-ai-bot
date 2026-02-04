export const runtime = "nodejs";
export const maxDuration = 300;

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

        const {
            prompt,
            aspectRatio = "16:9",
            resolution = "720p",
            numFrames = 129, // 129 = ~5 seconds, 85 = ~3.5 seconds
            proMode = false,
        } = await request.json();

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
            ? `${character.trigger_word} ${prompt}`
            : prompt;

        console.log("Hunyuan Video request:", { fullPrompt, aspectRatio, resolution });

        // Generate video with Hunyuan Video LoRA
        const result = await fal.subscribe("fal-ai/hunyuan-video-lora", {
            input: {
                prompt: fullPrompt,
                aspect_ratio: aspectRatio as "16:9" | "9:16",
                resolution: resolution as "480p" | "580p" | "720p",
                num_frames: numFrames,
                pro_mode: proMode,
                enable_safety_checker: false,
                loras: [
                    {
                        path: character.lora_url,
                        scale: 0.9,
                    },
                ],
            },
            logs: true,
            onQueueUpdate: (update) => {
                if (update.status === "IN_PROGRESS") {
                    console.log("Video progress:", update.logs?.map((l) => l.message).join(", "));
                }
            },
        });

        const videoUrl = result.data.video.url;

        // Save to generations
        await supabaseAdmin.from("generations").insert({
            user_id: user.id,
            type: "video",
            feature: "character_video",
            prompt: fullPrompt,
            result_urls: [videoUrl],
            thumbnail_url: character.thumbnail_url,
            character_id: characterId,
            metadata: {
                aspectRatio,
                resolution,
                numFrames,
                proMode,
                seed: result.data.seed,
            },
            status: "completed",
        });

        return NextResponse.json({
            success: true,
            videoUrl,
            seed: result.data.seed,
        });
    } catch (error: any) {
        console.error("Character video error:", error);
        return NextResponse.json(
            { error: error.message || "Video generation failed" },
            { status: 500 }
        );
    }
}