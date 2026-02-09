// src/app/api/generate/character-video/route.ts
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { generateCharacterVideo } from "@/lib/services/character-video";
import { generateCharacterScenes } from "@/lib/services/scene-generator";

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
            scene_duration = 3,
        } = body;

        // Validate
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

        // Check credits (video credits + image credits for each scene)
        const numScenes = custom_scenes?.length || scene_count;
        const requiredImageCredits = numScenes * 2; // 2 credits per character image
        const requiredVideoCredits = 1;

        const { data: credits } = await supabaseAdmin
            .from("credits")
            .select("image_credits, video_credits")
            .eq("user_id", user.id)
            .single();

        if (!credits ||
            credits.image_credits < requiredImageCredits ||
            credits.video_credits < requiredVideoCredits) {
            return NextResponse.json(
                { error: `אין מספיק קרדיטים (נדרשים ${requiredImageCredits} תמונה + ${requiredVideoCredits} וידאו)` },
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

        // Process in background
        processCharacterVideo(jobId, user.id, {
            character,
            topic,
            customScenes: custom_scenes,
            sceneCount: scene_count,
            style,
            aspectRatio: aspect_ratio,
            transitionStyle: transition_style,
            sceneDuration: scene_duration,
            requiredImageCredits,
            requiredVideoCredits,
        });

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
    requiredImageCredits: number;
    requiredVideoCredits: number;
}

async function processCharacterVideo(jobId: string, userId: string, options: ProcessOptions) {
    const updateProgress = async (progress: number) => {
        await supabaseAdmin
            .from("jobs")
            .update({ progress })
            .eq("id", jobId);
    };

    try {
        await supabaseAdmin
            .from("jobs")
            .update({ status: "processing", progress: 5 })
            .eq("id", jobId);

        // Generate scenes if not provided
        let scenes = options.customScenes;

        if (!scenes?.length && options.topic) {
            await updateProgress(10);

            scenes = await generateCharacterScenes({
                topic: options.topic,
                characterName: options.character.name,
                characterDescription: options.character.description,
                sceneCount: options.sceneCount,
                style: options.style as any,
                language: "he",
            });
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
                characterSettings: { trigger_word: options.character.trigger_word },
                scenes: scenes.map(desc => ({
                    description: desc,
                    duration: options.sceneDuration,
                })),
                aspectRatio: options.aspectRatio,
                transitionStyle: options.transitionStyle as any,
            },
            userId,
            jobId,
            updateProgress
        );

        // Save generation record
        const generationId = nanoid();
        await supabaseAdmin.from("generations").insert({
            id: generationId,
            user_id: userId,
            type: "video",
            feature: "character_video",
            prompt: options.topic || scenes.join(" | "),
            result_urls: [result.videoUrl, ...result.imageUrls],
            duration: result.duration,
            status: "completed",
            job_id: jobId,
            completed_at: new Date().toISOString(),
        });

        // Deduct credits
        const { data: currentCredits } = await supabaseAdmin
            .from("credits")
            .select("image_credits, video_credits")
            .eq("user_id", userId)
            .single();

        const newImageBalance = (currentCredits?.image_credits || 0) - options.requiredImageCredits;
        const newVideoBalance = (currentCredits?.video_credits || 0) - options.requiredVideoCredits;

        await supabaseAdmin
            .from("credits")
            .update({
                image_credits: newImageBalance,
                video_credits: newVideoBalance,
            })
            .eq("user_id", userId);

        // Record transactions
        await supabaseAdmin.from("credit_transactions").insert([
            {
                user_id: userId,
                credit_type: "image",
                amount: -options.requiredImageCredits,
                balance_after: newImageBalance,
                reason: "character_video_images",
                related_id: generationId,
            },
            {
                user_id: userId,
                credit_type: "video",
                amount: -options.requiredVideoCredits,
                balance_after: newVideoBalance,
                reason: "character_video",
                related_id: generationId,
            },
        ]);

        // Complete job
        await supabaseAdmin
            .from("jobs")
            .update({
                status: "completed",
                progress: 100,
                result: {
                    videoUrl: result.videoUrl,
                    imageUrls: result.imageUrls,
                    scenes,
                    duration: result.duration,
                } as any,
            })
            .eq("id", jobId);

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Character video processing error:", error);
        await supabaseAdmin
            .from("jobs")
            .update({ status: "failed", error: errorMessage })
            .eq("id", jobId);
    }
}