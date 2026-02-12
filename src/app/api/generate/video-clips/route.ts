import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import {
    createProjectFromUrl,
    waitForProject,
} from "@/lib/services/vizard";
import { deductCredits, addCredits } from "@/lib/services/credits";
import { CREDIT_COSTS } from "@/lib/config/credits";
import { updateUserStorage } from "@/lib/services/storage";

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const contentType = req.headers.get("content-type") || "";

        let videoUrl: string | undefined;
        let videoFile: Buffer | undefined;
        let fileName: string | undefined;
        let options: {
            language?: string;
            preferLength?: number[];
            aspectRatio?: "9:16" | "16:9" | "1:1" | "4:5";
            maxClips?: number;
        } = {};

        if (contentType.includes("multipart/form-data")) {
            const formData = await req.formData();
            const file = formData.get("video") as File;

            if (!file) {
                return NextResponse.json(
                    { error: "נא להעלות קובץ וידאו" },
                    { status: 400 }
                );
            }

            const arrayBuffer = await file.arrayBuffer();
            videoFile = Buffer.from(arrayBuffer);
            fileName = file.name;

            let preferLength: number[] = [0];
            const preferLengthRaw = formData.get("preferLength") as string;
            if (preferLengthRaw) {
                try {
                    preferLength = JSON.parse(preferLengthRaw);
                } catch {
                    preferLength = [0];
                }
            }

            options = {
                language: (formData.get("language") as string) || "he",
                preferLength,
                aspectRatio:
                    (formData.get("aspectRatio") as
                        | "9:16"
                        | "16:9"
                        | "1:1"
                        | "4:5") || "9:16",
                maxClips:
                    parseInt(formData.get("maxClips") as string) || 10,
            };
        } else {
            const body = await req.json();
            videoUrl = body.videoUrl;
            options = {
                language: body.language || "he",
                preferLength: Array.isArray(body.preferLength)
                    ? body.preferLength
                    : [0],
                aspectRatio: body.aspectRatio || "9:16",
                maxClips: body.maxClips || 10,
            };

            if (!videoUrl) {
                return NextResponse.json(
                    { error: "נא לספק קישור לסרטון" },
                    { status: 400 }
                );
            }
        }

        // Deduct credits upfront (atomic check + deduction)
        try {
            await deductCredits(user.id, "video_clips");
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
            type: "video_clips",
            status: "pending",
            progress: 0,
        });

        // Process in background
        if (videoFile && fileName) {
            processVideoClipsFromFile(
                jobId,
                user.id,
                videoFile,
                fileName,
                options
            );
        } else if (videoUrl) {
            processVideoClipsFromUrl(
                jobId,
                user.id,
                videoUrl,
                options
            );
        }

        return NextResponse.json({ jobId });
    } catch (error) {
        console.error("Video clips error:", error);
        return NextResponse.json(
            { error: "שגיאה בשרת" },
            { status: 500 }
        );
    }
}

async function processVideoClipsFromUrl(
    jobId: string,
    userId: string,
    videoUrl: string,
    options: any
) {
    try {
        await supabaseAdmin
            .from("jobs")
            .update({ status: "processing", progress: 5 })
            .eq("id", jobId);

        const result = await createProjectFromUrl(videoUrl, options);

        await supabaseAdmin
            .from("jobs")
            .update({ progress: 10 })
            .eq("id", jobId);

        const clips = await waitForProject(
            result.projectId,
            async (progress) => {
                await supabaseAdmin
                    .from("jobs")
                    .update({ progress: Math.min(progress, 80) })
                    .eq("id", jobId);
            }
        );

        await saveClipsToStorage(jobId, userId, videoUrl, clips);
    } catch (error: unknown) {
        const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

        await addCredits(
            userId,
            CREDIT_COSTS.video_clips,
            "החזר - חיתוך וידאו נכשל",
            jobId
        );

        await supabaseAdmin
            .from("jobs")
            .update({ status: "failed", error: errorMessage })
            .eq("id", jobId);
    }
}

async function processVideoClipsFromFile(
    jobId: string,
    userId: string,
    videoBuffer: Buffer,
    fileName: string,
    options: any
) {
    try {
        await supabaseAdmin
            .from("jobs")
            .update({ status: "processing", progress: 5 })
            .eq("id", jobId);

        const ext = fileName.split(".").pop() || "mp4";
        const originalPath = `${userId}/${jobId}/original_${fileName}`;
        await supabaseAdmin.storage
            .from("content")
            .upload(originalPath, videoBuffer, {
                contentType: `video/${ext}`,
                upsert: true,
            });

        const { data: originalUrlData } = supabaseAdmin.storage
            .from("content")
            .getPublicUrl(originalPath);

        const publicVideoUrl = originalUrlData.publicUrl;

        await supabaseAdmin
            .from("jobs")
            .update({ progress: 10 })
            .eq("id", jobId);

        const result = await createProjectFromUrl(publicVideoUrl, {
            ...options,
        });

        await supabaseAdmin
            .from("jobs")
            .update({ progress: 15 })
            .eq("id", jobId);

        const clips = await waitForProject(
            result.projectId,
            async (progress) => {
                await supabaseAdmin
                    .from("jobs")
                    .update({
                        progress: Math.min(
                            15 + Math.round(progress * 0.65),
                            80
                        ),
                    })
                    .eq("id", jobId);
            }
        );

        await saveClipsToStorage(jobId, userId, publicVideoUrl, clips);
    } catch (error: unknown) {
        const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

        await addCredits(
            userId,
            CREDIT_COSTS.video_clips,
            "החזר - חיתוך וידאו נכשל",
            jobId
        );

        await supabaseAdmin
            .from("jobs")
            .update({ status: "failed", error: errorMessage })
            .eq("id", jobId);
    }
}

async function saveClipsToStorage(
    jobId: string,
    userId: string,
    sourceUrl: string,
    clips: any[]
) {
    const uploadedClips: any[] = [];
    let totalFileSize = 0;

    for (let i = 0; i < clips.length; i++) {
        const clip = clips[i];

        try {
            const clipVideoUrl = clip.videoUrl || clip.video_url;

            if (!clipVideoUrl) {
                console.error(
                    `[VideoClips] Clip ${i} has no video URL, skipping`
                );
                continue;
            }

            const clipResponse = await fetch(clipVideoUrl);
            if (!clipResponse.ok) {
                console.error(
                    `[VideoClips] Failed to download clip ${i}: ${clipResponse.status}`
                );
                continue;
            }
            const clipBuffer = Buffer.from(
                await clipResponse.arrayBuffer()
            );

            // Track file size
            totalFileSize += clipBuffer.length;

            const clipPath = `${userId}/${jobId}/clip_${i + 1}.mp4`;
            await supabaseAdmin.storage
                .from("content")
                .upload(clipPath, clipBuffer, {
                    contentType: "video/mp4",
                    upsert: true,
                });

            const { data: clipUrlData } = supabaseAdmin.storage
                .from("content")
                .getPublicUrl(clipPath);

            const thumbnailUrl = clipUrlData.publicUrl;

            uploadedClips.push({
                url: clipUrlData.publicUrl,
                thumbnail: thumbnailUrl,
                title: clip.title || `קליפ ${i + 1}`,
                duration: clip.videoMsDuration
                    ? Math.round(clip.videoMsDuration / 1000)
                    : clip.duration,
                transcript: clip.transcript,
                viralScore: clip.viralScore,
                viralReason: clip.viralReason,
                editorUrl: clip.clipEditorUrl,
            });

            const progress =
                80 + Math.round(((i + 1) / clips.length) * 15);
            await supabaseAdmin
                .from("jobs")
                .update({ progress })
                .eq("id", jobId);
        } catch (error) {
            console.error(`[VideoClips] Failed to save clip ${i}:`, error);
        }
    }

    if (uploadedClips.length === 0) {
        await addCredits(
            userId,
            CREDIT_COSTS.video_clips,
            "החזר - לא נשמרו קליפים",
            jobId
        );

        await supabaseAdmin
            .from("jobs")
            .update({
                status: "failed",
                error: "לא הצלחנו לשמור אף קליפ",
            })
            .eq("id", jobId);
        return;
    }

    // Save generation record
    const generationId = nanoid();
    await supabaseAdmin.from("generations").insert({
        id: generationId,
        user_id: userId,
        type: "video",
        feature: "video_clips",
        source_url: sourceUrl,
        result_urls: uploadedClips.map((c) => c.url),
        thumbnail_url: uploadedClips[0]?.thumbnail,
        status: "completed",
        job_id: jobId,
        completed_at: new Date().toISOString(),
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
            result: { clips: uploadedClips },
        })
        .eq("id", jobId);
}