export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { addCredits } from "@/lib/services/credits";
import { CREDIT_COSTS } from "@/lib/config/credits";

const apiKey = process.env.GOOGLE_AI_API_KEY!;

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: job, error: jobError } = await supabaseAdmin
            .from("jobs")
            .select("*")
            .eq("id", params.id)
            .eq("user_id", user.id)
            .single();

        if (jobError || !job) {
            return NextResponse.json({ error: "Job not found" }, { status: 404 });
        }

        // Already in a terminal state — return immediately, no need to call Google
        if (job.status === "completed" || job.status === "failed") {
            return NextResponse.json(job);
        }

        const operationName = (job.result as any)?.operationName;
        if (!operationName) {
            return NextResponse.json(job);
        }

        // Poll Google's long-running operation
        const opRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`
        );

        if (!opRes.ok) {
            console.error("Operation poll error:", await opRes.text());
            // Don't fail — just return current DB state and let client retry
            return NextResponse.json(job);
        }

        const operation = await opRes.json();

        // Still running — nudge progress and return
        if (!operation.done) {
            const newProgress = Math.min((job.progress ?? 10) + 5, 90);
            await supabaseAdmin
                .from("jobs")
                .update({ progress: newProgress })
                .eq("id", job.id);

            return NextResponse.json({ ...job, progress: newProgress });
        }

        // Google reported an error
        if (operation.error) {
            await addCredits(
                user.id,
                CREDIT_COSTS.video_generation,
                "החזר - יצירת וידאו נכשלה"
            );

            const failedJob = {
                ...job,
                status: "failed",
                progress: 0,
                error: operation.error.message || "יצירת הוידאו נכשלה",
            };

            await supabaseAdmin
                .from("jobs")
                .update({
                    status: failedJob.status,
                    progress: failedJob.progress,
                    error: failedJob.error,
                })
                .eq("id", job.id);

            return NextResponse.json(failedJob);
        }

        // ✅ Operation succeeded — extract the video
        const samples =
            operation.response?.generateVideoResponse?.generatedSamples ?? [];

        if (samples.length === 0) {
            // Response not fully populated yet — tell client to retry
            return NextResponse.json(job);
        }

        const videoData = samples[0]?.video;
        if (!videoData) return NextResponse.json(job);

        // Build a buffer from either base64 payload or a downloadable URI
        let videoBuffer: Buffer | null = null;

        if (videoData.bytesBase64Encoded) {
            videoBuffer = Buffer.from(videoData.bytesBase64Encoded, "base64");
        } else if (videoData.uri) {
            // Google Files API URI — append key + alt=media to download the raw bytes
            const downloadUrl = videoData.uri.includes("?")
                ? `${videoData.uri}&alt=media&key=${apiKey}`
                : `${videoData.uri}?alt=media&key=${apiKey}`;

            const dlRes = await fetch(downloadUrl);
            if (dlRes.ok) {
                videoBuffer = Buffer.from(await dlRes.arrayBuffer());
            } else {
                console.error("Video download error:", await dlRes.text());
            }
        }

        let finalVideoUrl: string | null = null;

        // Upload to Supabase storage for permanent hosting
        if (videoBuffer) {
            const fileName = `videos/${user.id}/${job.id}.mp4`;
            const { error: uploadError } = await supabaseAdmin.storage
                .from("generated-videos")
                .upload(fileName, videoBuffer, {
                    contentType: "video/mp4",
                    upsert: true,
                });

            if (!uploadError) {
                const {
                    data: { publicUrl },
                } = supabaseAdmin.storage
                    .from("generated-videos")
                    .getPublicUrl(fileName);

                finalVideoUrl = publicUrl;
            } else {
                console.error("Supabase upload error:", uploadError);
            }
        }

        // Fallback: serve the raw Google URI if upload failed
        if (!finalVideoUrl && videoData.uri) {
            finalVideoUrl = videoData.uri;
        }

        // Nothing worked — mark failed and refund
        if (!finalVideoUrl) {
            await addCredits(
                user.id,
                CREDIT_COSTS.video_generation,
                "החזר - לא ניתן להוריד את הוידאו"
            );

            await supabaseAdmin
                .from("jobs")
                .update({ status: "failed", error: "לא ניתן להוריד את הוידאו" })
                .eq("id", job.id);

            return NextResponse.json({
                ...job,
                status: "failed",
                error: "לא ניתן להוריד את הוידאו",
            });
        }

        const updatedResult = { ...(job.result as Record<string, any>), videoUrl: finalVideoUrl };

        await supabaseAdmin
            .from("jobs")
            .update({ status: "completed", progress: 100, result: updatedResult })
            .eq("id", job.id);

        return NextResponse.json({
            ...job,
            status: "completed",
            progress: 100,
            result: updatedResult,
        });
    } catch (error: any) {
        console.error("Job GET error:", error);
        return NextResponse.json(
            { error: error.message || "שגיאה בבדיקת סטטוס" },
            { status: 500 }
        );
    }
}