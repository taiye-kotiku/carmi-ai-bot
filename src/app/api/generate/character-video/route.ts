import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { generateCharacterVideo } from "@/lib/services/character-video";
import { generateCharacterScenes } from "@/lib/services/scene-generator";
import { after } from "next/server";
import { deductCredits, addCredits } from "@/lib/services/credits";
import { CREDIT_COSTS } from "@/lib/config/credits";
import { updateUserStorage } from "@/lib/services/storage";

export const maxDuration = 300;

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const {
            character_id,
            topic,
            custom_scenes,
            scene_count = 5,
            style = "storytelling",
            aspect_ratio = "9:16",
            transition_style = "fade",
            scene_duration = 4,
        } = body;

        if (!character_id) {
            return NextResponse.json(
                { error: "נא לבחור דמות" },
                { status: 400 }
            );
        }

        if (!topic && !custom_scenes?.length) {
            return NextResponse.json(
                { error: "נא להזין נושא או סצנות" },
                { status: 400 }
            );
        }

        // Get character
        const { data: character, error: charError } = await supabaseAdmin
            .from("characters")
            .select("*")
            .eq("id", character_id)
            .eq("user_id", user.id)
            .single();

        if (charError || !character) {
            return NextResponse.json(
                { error: "דמות לא נמצאה" },
                { status: 404 }
            );
        }

        if (character.status !== "ready" || !character.lora_url) {
            return NextResponse.json(
                { error: "הדמות עדיין לא מוכנה. נא לאמן אותה קודם." },
                { status: 400 }
            );
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

        // Create job
        const jobId = nanoid();
        await supabaseAdmin.from("jobs").insert({
            id: jobId,
            user_id: user.id,
            type: "character_video",
            status: "pending",
            progress: 0,
        });

        // Use after() to keep the function alive after response
        after(
            processCharacterVideo(jobId, user.id, {
                character,
                topic,
                customScenes: custom_scenes,
                sceneCount: scene_count,
                style,
                aspectRatio: aspect_ratio,
                transitionStyle: transition_style,
                sceneDuration: scene_duration,
            })
        );

        return NextResponse.json({ jobId });
    } catch (error) {
        console.error("Character video error:", error);
        return NextResponse.json({ error: "שגיאה בשרת" }, { status: 500 });
    }
}

interface ProcessOptions {
    character: any;
    topic?: string;
    customScenes?: string[];
    sceneCount: number;
    style: string;
    aspectRatio: string;
    transitionStyle: string;
    sceneDuration: number;
}

async function processCharacterVideo(
    jobId: string,
    userId: string,
    options: ProcessOptions
) {
    const updateProgress = async (progress: number, status?: string) => {
        const update: any = { progress };
        if (status) update.status = status;
        await supabaseAdmin
            .from("jobs")
            .update(update)
            .eq("id", jobId);
    };

    try {
        await updateProgress(5, "processing");

        // Generate scenes if not provided
        let scenes = options.customScenes;

        if (!scenes?.length && options.topic) {
            await updateProgress(8);

            scenes = await generateCharacterScenes({
                topic: options.topic,
                characterName: options.character.name,
                characterDescription: options.character.description,
                sceneCount: options.sceneCount,
                style: options.style as any,
                language: "he",
            });

            console.log(`[CharacterVideo] Generated ${scenes?.length} scenes`);
        }

        if (!scenes?.length) {
            throw new Error("No scenes generated");
        }

        await updateProgress(15);

        // Generate video
        const result = await generateCharacterVideo(
            {
                characterId: options.character.id,
                characterReferenceImages: options.character.reference_images || [],
                characterSettings: {
                    trigger_word: options.character.trigger_word,
                    lora_url: options.character.lora_url,
                    lora_scale: options.character.lora_scale,
                },
                scenes: scenes.map((desc) => ({
                    description: desc,
                    duration: options.sceneDuration,
                })),
                aspectRatio: options.aspectRatio,
                transitionStyle: options.transitionStyle as any,
                sceneDuration: options.sceneDuration,
            },
            userId,
            jobId,
            updateProgress
        );

        // Calculate file sizes from result URLs
        let totalFileSize = 0;
        const allUrls = [result.videoUrl, ...result.sceneVideoUrls, ...result.imageUrls];

        for (const url of allUrls) {
            if (!url) continue;
            try {
                const headRes = await fetch(url, { method: "HEAD" });
                const contentLength = headRes.headers.get("content-length");
                if (contentLength) {
                    totalFileSize += parseInt(contentLength, 10);
                }
            } catch {
                // Estimate ~2MB per video, ~500KB per image
                if (url.includes(".mp4") || url.includes("video")) {
                    totalFileSize += 2 * 1024 * 1024;
                } else {
                    totalFileSize += 500 * 1024;
                }
            }
        }

        // Save generation record
        const generationId = nanoid();
        await supabaseAdmin.from("generations").insert({
            id: generationId,
            user_id: userId,
            type: "video",
            feature: "character_video",
            prompt: options.topic || scenes.join(" | "),
            result_urls: [result.videoUrl, ...result.sceneVideoUrls, ...result.imageUrls],
            thumbnail_url: result.thumbnailUrl,
            duration: result.duration,
            status: "completed",
            job_id: jobId,
            completed_at: new Date().toISOString(),
            character_id: options.character.id,
            file_size_bytes: totalFileSize,
            files_deleted: false,
        });

        // Update user storage
        if (totalFileSize > 0) {
            await updateUserStorage(userId, totalFileSize);
        }

        // Complete job
        await supabaseAdmin
            .from("jobs")
            .update({
                status: "completed",
                progress: 100,
                result: {
                    videoUrl: result.videoUrl,
                    thumbnailUrl: result.thumbnailUrl,
                    imageUrls: result.imageUrls,
                    sceneVideoUrls: result.sceneVideoUrls,
                    scenes,
                    duration: result.duration,
                } as any,
            })
            .eq("id", jobId);

        console.log(`[CharacterVideo] Job ${jobId} completed successfully`);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`[CharacterVideo] Job ${jobId} failed:`, error);

        await addCredits(
            userId,
            CREDIT_COSTS.video_generation,
            "החזר - יצירת וידאו דמות נכשלה",
            jobId
        );

        await supabaseAdmin
            .from("jobs")
            .update({ status: "failed", error: errorMessage })
            .eq("id", jobId);
    }
}