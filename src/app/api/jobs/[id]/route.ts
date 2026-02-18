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
        const { data: { user } } = await supabase.auth.getUser();

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
        if (!operationName) return NextResponse.json(job);

        const opRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`
        );

        if (!opRes.ok) {
            const errText = await opRes.text();
            console.error("❌ Operation poll failed:", opRes.status, errText);
            return NextResponse.json(job);
        }

        const operation = await opRes.json();

        // ✅ LOG THE FULL RAW RESPONSE — paste this in your Vercel/server logs
        console.log("📦 FULL OPERATION RESPONSE:", JSON.stringify(operation, null, 2));

        if (!operation.done) {
            const newProgress = Math.min((job.progress ?? 10) + 5, 90);
            await supabaseAdmin.from("jobs").update({ progress: newProgress }).eq("id", job.id);
            return NextResponse.json({ ...job, progress: newProgress });
        }

        if (operation.error) {
            console.error("❌ Google operation error:", operation.error);
            await addCredits(user.id, CREDIT_COSTS.video_generation, "החזר - יצירת וידאו נכשלה");
            await supabaseAdmin.from("jobs").update({ status: "failed", progress: 0, error: operation.error.message }).eq("id", job.id);
            return NextResponse.json({ ...job, status: "failed", error: operation.error.message });
        }

        // Try every known path Google might use
        const samples =
            operation.response?.generateVideoResponse?.generatedSamples ??
            operation.response?.generatedSamples ??
            operation.response?.videos ??
            [];

        console.log("🎬 Samples found:", samples.length);
        console.log("🎬 Samples data:", JSON.stringify(samples, null, 2));

        if (samples.length === 0) {
            console.error("❌ No samples in response");
            return NextResponse.json(job);
        }

        const videoData = samples[0]?.video ?? samples[0];
        console.log("🎬 Video data:", JSON.stringify(videoData, null, 2));

        let videoBuffer: Buffer | null = null;

        if (videoData?.bytesBase64Encoded) {
            console.log("📥 Using base64 data");
            videoBuffer = Buffer.from(videoData.bytesBase64Encoded, "base64");

        } else if (videoData?.uri) {
            console.log("📥 Raw URI from Google:", videoData.uri);

            // Build the authenticated download URL
            const parsedUri = new URL(videoData.uri);
            const downloadUrl = `https://generativelanguage.googleapis.com/download${parsedUri.pathname}:download?alt=media&key=${apiKey}`;
            console.log("📥 Download URL:", downloadUrl);

            const dlRes = await fetch(downloadUrl);
            console.log("📥 Download status:", dlRes.status, dlRes.statusText);

            if (dlRes.ok) {
                videoBuffer = Buffer.from(await dlRes.arrayBuffer());
                console.log("✅ Buffer size:", videoBuffer.length);
            } else {
                const errBody = await dlRes.text();
                console.error("❌ Download failed:", dlRes.status, errBody);
            }
        } else {
            console.error("❌ No uri or bytesBase64Encoded in videoData");
        }

        let finalVideoUrl: string | null = null;

        if (videoBuffer && videoBuffer.length > 0) {
            const fileName = `videos/${user.id}/${job.id}.mp4`;
            console.log("⬆️ Uploading to Supabase storage:", fileName);

            const { error: uploadError } = await supabaseAdmin.storage
                .from("generated-videos")
                .upload(fileName, videoBuffer, { contentType: "video/mp4", upsert: true });

            if (!uploadError) {
                const { data: { publicUrl } } = supabaseAdmin.storage
                    .from("generated-videos")
                    .getPublicUrl(fileName);
                finalVideoUrl = publicUrl;
                console.log("✅ Uploaded to Supabase:", finalVideoUrl);
            } else {
                console.error("❌ Supabase upload error:", JSON.stringify(uploadError));
            }
        } else {
            console.error("❌ videoBuffer is empty or null");
        }

        if (!finalVideoUrl) {
            await addCredits(user.id, CREDIT_COSTS.video_generation, "החזר - לא ניתן להוריד את הוידאו");
            await supabaseAdmin.from("jobs").update({ status: "failed", error: "לא ניתן להוריד את הוידאו" }).eq("id", job.id);
            return NextResponse.json({ ...job, status: "failed", error: "לא ניתן להוריד את הוידאו" });
        }

        const updatedResult = { ...(job.result as Record<string, any>), videoUrl: finalVideoUrl };
        await supabaseAdmin.from("jobs").update({ status: "completed", progress: 100, result: updatedResult }).eq("id", job.id);
        return NextResponse.json({ ...job, status: "completed", progress: 100, result: updatedResult });

    } catch (error: any) {
        console.error("❌ Job GET error:", error);
        return NextResponse.json({ error: error.message || "שגיאה בבדיקת סטטוס" }, { status: 500 });
    }
}