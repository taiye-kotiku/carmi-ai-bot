export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { addCredits } from "@/lib/services/credits";
import { CREDIT_COSTS } from "@/lib/config/credits";

const apiKey = process.env.GOOGLE_AI_API_KEY!;

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

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
            .eq("id", id)
            .eq("user_id", user.id)
            .single();

        if (jobError || !job) {
            return NextResponse.json({ error: "Job not found" }, { status: 404 });
        }

        if (job.status === "completed" || job.status === "failed") {
            return NextResponse.json(job);
        }

        const operationName = (job.result as { operationName?: string })?.operationName;
        if (!operationName) {
            return NextResponse.json(job);
        }

        // Poll Google's long-running operation
        const opRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`
        );

        if (!opRes.ok) {
            console.error("Operation poll error:", await opRes.text());
            return NextResponse.json(job);
        }

        const operation = await opRes.json();

        // Still running — nudge progress
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
            await supabaseAdmin
                .from("jobs")
                .update({
                    status: "failed",
                    progress: 0,
                    error: operation.error.message || "יצירת הוידאו נכשלה",
                })
                .eq("id", job.id);

            return NextResponse.json({
                ...job,
                status: "failed",
                error: operation.error.message || "יצירת הוידאו נכשלה",
            });
        }

        const samples =
            operation.response?.generateVideoResponse?.generatedSamples ?? [];

        if (samples.length === 0) {
            return NextResponse.json(job);
        }

        const videoData = samples[0]?.video;
        if (!videoData) return NextResponse.json(job);

        // ✅ Build the correct authenticated download URL
        // Google URI:  https://generativelanguage.googleapis.com/v1beta/files/FILE_ID
        // Download URL: https://generativelanguage.googleapis.com/download/v1beta/files/FILE_ID:download?alt=media&key=API_KEY
        let videoBuffer: Buffer | null = null;

        if (videoData.bytesBase64Encoded) {
            videoBuffer = Buffer.from(videoData.bytesBase64Encoded, "base64");
        } else if (videoData.uri) {
            try {
                const parsedUri = new URL(videoData.uri);

                // Insert /download before /v1beta and append :download
                const downloadUrl =
                    `https://generativelanguage.googleapis.com/download${parsedUri.pathname}:download?alt=media&key=${apiKey}`;

                console.log("Downloading video from:", downloadUrl);

                const dlRes = await fetch(downloadUrl);

                if (dlRes.ok) {
                    videoBuffer = Buffer.from(await dlRes.arrayBuffer());
                    console.log("Video downloaded, size:", videoBuffer.length);
                } else {
                    const errText = await dlRes.text();
                    console.error("Video download failed:", dlRes.status, errText);
                }
            } catch (e) {
                console.error("Download URL construction failed:", e);
            }
        }

        // Upload to Supabase storage so it's permanently accessible
        let finalVideoUrl: string | null = null;

        if (videoBuffer && videoBuffer.length > 0) {
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
                console.log("Video uploaded to Supabase:", finalVideoUrl);
            } else {
                console.error("Supabase upload error:", uploadError);
            }
        }

        // If everything failed, refund and mark failed
        if (!finalVideoUrl) {
            await addCredits(
                user.id,
                CREDIT_COSTS.video_generation,
                "החזר - לא ניתן להוריד את הוידאו"
            );
            await supabaseAdmin
                .from("jobs")
                .update({
                    status: "failed",
                    error: "לא ניתן להוריד את הוידאו",
                })
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
            .update({
                status: "completed",
                progress: 100,
                result: updatedResult,
            })
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