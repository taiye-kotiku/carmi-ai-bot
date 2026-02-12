import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse, after } from "next/server";
import { nanoid } from "nanoid";
import { deductCredits, addCredits } from "@/lib/services/credits";
import { CREDIT_COSTS } from "@/lib/config/credits";
import { updateUserStorage } from "@/lib/services/storage";
import sharp from "sharp";

export const maxDuration = 300; // 5 minutes

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

        const body = await req.json();
        const videoUrl: string = body.videoUrl;
        const backgroundUrl: string | null = body.backgroundUrl || null;
        const imageCount: number = parseInt(body.imageCount) || 10;

        if (!videoUrl) {
            return NextResponse.json(
                { error: "נא לספק קישור לוידאו" },
                { status: 400 }
            );
        }

        // Deduct credits upfront
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
            type: "video_to_images",
            status: "pending",
            progress: 0,
        });

        // Use after() to keep processing alive after response is sent
        after(
            processVideoToImages(jobId, user.id, videoUrl, backgroundUrl, imageCount)
        );

        return NextResponse.json({ jobId });
    } catch (error) {
        console.error("Video to images error:", error);
        return NextResponse.json(
            { error: "שגיאה בשרת: " + (error instanceof Error ? error.message : "Unknown error") },
            { status: 500 }
        );
    }
}

// ─── Background Processing ───────────────────────────────────────────

async function processVideoToImages(
    jobId: string,
    userId: string,
    videoUrl: string,
    backgroundUrl: string | null,
    imageCount: number
) {
    try {
        await updateJob(jobId, { status: "processing", progress: 10 });

        // Step 1: Download video
        console.log(`[video-to-images] Downloading video: ${videoUrl.substring(0, 80)}...`);
        const videoResponse = await fetch(videoUrl);
        if (!videoResponse.ok) {
            throw new Error(`Failed to download video: ${videoResponse.status}`);
        }
        const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
        console.log(`[video-to-images] Video downloaded: ${(videoBuffer.length / 1024 / 1024).toFixed(1)}MB`);

        await updateJob(jobId, { progress: 20 });

        // Step 2: Extract frames using external service
        console.log(`[video-to-images] Extracting frames...`);
        const frames = await extractFramesViaService(videoBuffer, imageCount * 3);
        console.log(`[video-to-images] Got ${frames.length} raw frames`);

        if (frames.length === 0) {
            throw new Error("לא הצלחנו לחלץ תמונות מהווידאו. נסה וידאו אחר.");
        }

        await updateJob(jobId, { progress: 50 });

        // Step 3: Score frames by sharpness and pick the best ones
        console.log(`[video-to-images] Scoring frames by quality...`);
        const scoredFrames = await scoreFrames(frames);
        const bestFrames = scoredFrames
            .sort((a, b) => b.score - a.score)
            .slice(0, imageCount);
        console.log(`[video-to-images] Selected ${bestFrames.length} best frames`);

        await updateJob(jobId, { progress: 70 });

        // Step 4: Upload best frames to storage
        const imageUrls: Array<{ url: string; timestamp: number; score: number }> = [];
        for (let i = 0; i < bestFrames.length; i++) {
            const frame = bestFrames[i];
            const imageFileName = `images/${userId}/${jobId}/extracted_${i + 1}.jpg`;

            // Convert to high-quality JPEG using sharp
            const jpegBuffer = await sharp(frame.buffer)
                .jpeg({ quality: 90 })
                .toBuffer();

            await supabaseAdmin.storage
                .from("content")
                .upload(imageFileName, jpegBuffer, {
                    contentType: "image/jpeg",
                    upsert: true,
                });

            const { data: urlData } = supabaseAdmin.storage
                .from("content")
                .getPublicUrl(imageFileName);

            imageUrls.push({
                url: urlData.publicUrl,
                timestamp: frame.timestamp,
                score: frame.score,
            });
        }

        await updateJob(jobId, { progress: 90 });

        // Step 5: Update storage usage
        const totalSize = bestFrames.reduce((sum, f) => sum + f.buffer.length, 0);
        await updateUserStorage(userId, totalSize);

        // Step 6: Complete job
        await supabaseAdmin
            .from("jobs")
            .update({
                status: "completed",
                progress: 100,
                result: {
                    images: imageUrls,
                    videoUrl: null,
                },
            })
            .eq("id", jobId);

        // Save generation record
        await supabaseAdmin.from("generations").insert({
            id: nanoid(),
            user_id: userId,
            type: "image",
            feature: "video_to_images",
            prompt: `Extracted ${bestFrames.length} best frames from video`,
            result_urls: imageUrls.map((img) => img.url),
            thumbnail_url: imageUrls[0]?.url,
            status: "completed",
            job_id: jobId,
            completed_at: new Date().toISOString(),
        });

        console.log(`[video-to-images] Job ${jobId} completed with ${imageUrls.length} images`);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`[video-to-images] Job ${jobId} failed:`, errorMessage);

        // Refund credits
        await addCredits(
            userId,
            CREDIT_COSTS.video_generation,
            "החזר - עיבוד וידאו נכשל",
            jobId
        );

        await supabaseAdmin
            .from("jobs")
            .update({ status: "failed", error: errorMessage })
            .eq("id", jobId);
    }
}

// ─── Frame Extraction via External Service ───────────────────────────

async function extractFramesViaService(
    videoBuffer: Buffer,
    frameCount: number
): Promise<Array<{ buffer: Buffer; timestamp: number }>> {
    // Use the existing Render frame extractor service
    const renderApiUrl = (
        process.env.VIDEO_PROCESSOR_API_URL ||
        process.env.RENDER_API_URL ||
        "https://frame-extractor-oou7.onrender.com"
    ).replace(/\/$/, "");

    console.log(`[frame-extract] Using service: ${renderApiUrl}`);

    const videoBase64 = videoBuffer.toString("base64");

    // Try multiple endpoints (the service might use different paths)
    const endpoints = ["/extract-frames", "/extract-reel", "/frames"];

    for (const endpoint of endpoints) {
        try {
            const fullUrl = `${renderApiUrl}${endpoint}`;
            console.log(`[frame-extract] Trying: ${fullUrl}`);

            const response = await fetch(fullUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    video_base64: videoBase64,
                    frame_count: frameCount,
                    fps: 1,
                }),
                signal: AbortSignal.timeout(120000), // 2 minutes timeout
            });

            if (!response.ok) {
                if (response.status === 404) continue;
                const errText = await response.text();
                console.warn(`[frame-extract] ${endpoint} returned ${response.status}: ${errText}`);
                continue;
            }

            const data = await response.json();
            const rawFrames = data.frames || data.images || [];

            if (rawFrames.length === 0) {
                console.warn(`[frame-extract] ${endpoint} returned 0 frames`);
                continue;
            }

            console.log(`[frame-extract] Success via ${endpoint}: ${rawFrames.length} frames`);

            // Convert base64 frames to buffers
            const frames: Array<{ buffer: Buffer; timestamp: number }> = [];
            for (let i = 0; i < rawFrames.length; i++) {
                const frame = rawFrames[i];
                const base64 = typeof frame === "string"
                    ? (frame.includes(",") ? frame.split(",")[1] : frame)
                    : (frame.data || frame);

                try {
                    const buf = Buffer.from(base64, "base64");
                    if (buf.length > 1000) {
                        // Sanity check - valid image should be > 1KB
                        frames.push({
                            buffer: buf,
                            timestamp: frame.timestamp || i,
                        });
                    }
                } catch {
                    // Skip invalid frames
                }
            }

            if (frames.length > 0) return frames;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(`[frame-extract] ${endpoint} error: ${msg}`);
        }
    }

    throw new Error(
        "שירות חילוץ תמונות לא זמין. נא לוודא ש-RENDER_API_URL מוגדר נכון."
    );
}

// ─── Frame Quality Scoring ──────────────────────────────────────────

async function scoreFrames(
    frames: Array<{ buffer: Buffer; timestamp: number }>
): Promise<Array<{ buffer: Buffer; timestamp: number; score: number }>> {
    const scored: Array<{ buffer: Buffer; timestamp: number; score: number }> = [];

    for (const frame of frames) {
        try {
            const score = await calculateSharpness(frame.buffer);
            scored.push({ ...frame, score });
        } catch {
            // Skip frames that can't be processed
            scored.push({ ...frame, score: 0 });
        }
    }

    return scored;
}

/**
 * Calculate image sharpness using Laplacian variance via sharp.
 * Higher variance = sharper image = better quality frame.
 */
async function calculateSharpness(imageBuffer: Buffer): Promise<number> {
    try {
        // Get grayscale raw pixels
        const { data, info } = await sharp(imageBuffer)
            .grayscale()
            .resize(320, 240, { fit: "inside" }) // Downsize for speed
            .raw()
            .toBuffer({ resolveWithObject: true });

        const { width, height } = info;
        const pixels = data;

        // Calculate variance (proxy for sharpness)
        let sum = 0;
        let sumSq = 0;
        const len = pixels.length;

        for (let i = 0; i < len; i++) {
            const v = pixels[i];
            sum += v;
            sumSq += v * v;
        }

        const mean = sum / len;
        const variance = sumSq / len - mean * mean;

        return variance;
    } catch {
        return 0;
    }
}

// ─── Helpers ────────────────────────────────────────────────────────

async function updateJob(
    jobId: string,
    updates: Record<string, unknown>
) {
    await supabaseAdmin
        .from("jobs")
        .update(updates)
        .eq("id", jobId);
}
