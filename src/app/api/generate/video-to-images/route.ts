import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { deductCredits, addCredits } from "@/lib/services/credits";
import { CREDIT_COSTS } from "@/lib/config/credits";
import { updateUserStorage } from "@/lib/services/storage";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
// Using Python script for MediaPipe processing (better for serverless)

const execAsync = promisify(exec);

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

        const formData = await req.formData();
        const videoFile = formData.get("video") as File;
        const backgroundImage = formData.get("backgroundImage") as File | null;
        const imageCount = parseInt(formData.get("imageCount") as string) || 10;

        if (!videoFile) {
            return NextResponse.json(
                { error: "נא להעלות קובץ וידאו" },
                { status: 400 }
            );
        }

        // Validate file size (100MB max)
        if (videoFile.size > 100 * 1024 * 1024) {
            return NextResponse.json(
                { error: "גודל הקובץ חייב להיות עד 100MB" },
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

        // Process in background
        processVideoToImages(jobId, user.id, videoFile, backgroundImage, imageCount);

        return NextResponse.json({ jobId });
    } catch (error) {
        console.error("Video to images error:", error);
        return NextResponse.json(
            { error: "שגיאה בשרת" },
            { status: 500 }
        );
    }
}

async function processVideoToImages(
    jobId: string,
    userId: string,
    videoFile: File,
    backgroundImage: File | null,
    imageCount: number
) {
    try {
        await supabaseAdmin
            .from("jobs")
            .update({ status: "processing", progress: 10 })
            .eq("id", jobId);

        // Convert File to Buffer
        const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
        const backgroundBuffer = backgroundImage
            ? Buffer.from(await backgroundImage.arrayBuffer())
            : null;

        // Upload original video to storage
        const videoFileName = `videos/${userId}/${jobId}/original_${videoFile.name}`;
        await supabaseAdmin.storage
            .from("content")
            .upload(videoFileName, videoBuffer, {
                contentType: videoFile.type,
                upsert: true,
            });

        await supabaseAdmin
            .from("jobs")
            .update({ progress: 20 })
            .eq("id", jobId);

        // Extract best frames with selfie segmentation
        await supabaseAdmin
            .from("jobs")
            .update({ progress: 30 })
            .eq("id", jobId);
        
        const extractedImages = await extractBestFrames(
            videoBuffer,
            imageCount,
            backgroundBuffer,
            jobId
        );

        await supabaseAdmin
            .from("jobs")
            .update({ progress: 80 })
            .eq("id", jobId);

        // Upload extracted images
        const imageUrls: Array<{ url: string; timestamp: number; score: number }> = [];
        for (let i = 0; i < extractedImages.length; i++) {
            const imageBuffer = extractedImages[i].buffer;
            const imageFileName = `images/${userId}/${jobId}/extracted_${i + 1}.jpg`;
            
            await supabaseAdmin.storage
                .from("content")
                .upload(imageFileName, imageBuffer, {
                    contentType: "image/jpeg",
                    upsert: true,
                });

            const { data: urlData } = supabaseAdmin.storage
                .from("content")
                .getPublicUrl(imageFileName);

            imageUrls.push({
                url: urlData.publicUrl,
                timestamp: extractedImages[i].timestamp,
                score: extractedImages[i].score,
            });
        }

        await supabaseAdmin
            .from("jobs")
            .update({ progress: 70 })
            .eq("id", jobId);
        
        let mergedVideoUrl: string | null = null;
        if (backgroundBuffer) {
            // Create merged video with background
            await supabaseAdmin
                .from("jobs")
                .update({ progress: 75 })
                .eq("id", jobId);
            
            const mergedVideoBuffer = await createMergedVideo(
                videoBuffer,
                backgroundBuffer,
                jobId
            );

            const mergedVideoFileName = `videos/${userId}/${jobId}/merged.mp4`;
            await supabaseAdmin.storage
                .from("content")
                .upload(mergedVideoFileName, mergedVideoBuffer, {
                    contentType: "video/mp4",
                    upsert: true,
                });

            const { data: mergedUrlData } = supabaseAdmin.storage
                .from("content")
                .getPublicUrl(mergedVideoFileName);

            mergedVideoUrl = mergedUrlData.publicUrl;
        }

        // Update storage
        const totalSize = videoBuffer.length + imageUrls.reduce((sum, img) => sum + 100000, 0);
        await updateUserStorage(userId, totalSize);

        // Complete job
        await supabaseAdmin
            .from("jobs")
            .update({
                status: "completed",
                progress: 100,
                result: {
                    images: imageUrls,
                    videoUrl: mergedVideoUrl,
                },
            })
            .eq("id", jobId);

        // Save generation record
        const generationId = nanoid();
        await supabaseAdmin.from("generations").insert({
            id: generationId,
            user_id: userId,
            type: backgroundBuffer ? "video" : "image",
            feature: "video_to_images",
            prompt: `Extracted ${imageCount} best frames from video`,
            result_urls: imageUrls.map((img) => img.url),
            thumbnail_url: imageUrls[0]?.url,
            status: "completed",
            job_id: jobId,
            completed_at: new Date().toISOString(),
        });
    } catch (error: unknown) {
        const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

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

async function extractBestFrames(
    videoBuffer: Buffer,
    count: number,
    backgroundBuffer: Buffer | null,
    jobId: string
): Promise<Array<{ buffer: Buffer; timestamp: number; score: number }>> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "video-process-"));
    const videoPath = path.join(tempDir, "input_video.mp4");
    const framesDir = path.join(tempDir, "frames");
    
    try {
        // Write video to temp file
        await fs.writeFile(videoPath, videoBuffer);
        await fs.mkdir(framesDir, { recursive: true });
        
        // Use Python script for MediaPipe processing
        await supabaseAdmin
            .from("jobs")
            .update({ progress: 35 })
            .eq("id", jobId);
        
        // Try to use Python script, fallback to external service if not available
        const scriptPath = path.join(process.cwd(), "scripts", "video-processor.py");
        let stdout: string, stderr: string;
        let usePython = false;
        
        try {
            // Check if Python script exists
            await fs.access(scriptPath);
            
            // Try python3 first
            try {
                ({ stdout, stderr } = await execAsync(
                    `python3 "${scriptPath}" extract "${videoPath}" ${count} "${framesDir}"`
                ));
                usePython = true;
            } catch (error) {
                // Fallback to python
                try {
                    ({ stdout, stderr } = await execAsync(
                        `python "${scriptPath}" extract "${videoPath}" ${count} "${framesDir}"`
                    ));
                    usePython = true;
                } catch (fallbackError) {
                    console.log("Python not available, will use external service");
                    usePython = false;
                }
            }
        } catch {
            console.log("Python script not found, will use external service");
            usePython = false;
        }
        
        let bestFrames: Array<{
            buffer: Buffer;
            timestamp: number;
            score: number;
        }> = [];
        
        if (usePython) {
            // Parse progress from stderr and update job
            const progressLines = stderr.split("\n").filter((line: string) => line.startsWith("PROGRESS:"));
            for (const line of progressLines) {
                const progress = parseInt(line.split(":")[1]);
                // Map Python progress (0-100) to our range (35-60)
                const mappedProgress = 35 + Math.floor(progress * 0.25);
                await supabaseAdmin
                    .from("jobs")
                    .update({ progress: mappedProgress })
                    .eq("id", jobId);
            }
            
            // Parse results from stdout
            const results = JSON.parse(stdout);
            
            // Read extracted frames
            for (const result of results) {
                const frameBuffer = await fs.readFile(result.path);
                bestFrames.push({
                    buffer: frameBuffer,
                    timestamp: result.timestamp,
                    score: result.score,
                });
            }
        } else {
            // Use external service (similar to reel-extractor)
            await supabaseAdmin
                .from("jobs")
                .update({ progress: 40 })
                .eq("id", jobId);
            
            // Use RENDER_API_URL service if available
            const renderApiUrl = process.env.RENDER_API_URL || "https://frame-extractor-oou7.onrender.com";
            const videoBase64 = videoBuffer.toString("base64");
            
            try {
                const response = await fetch(`${renderApiUrl}/extract-frames`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        video_base64: videoBase64,
                        frame_count: count * 2,
                        fps: 1,
                    }),
                });
                
                if (response.ok) {
                    const data = await response.json();
                    const frames = data.frames || data.images || [];
                    
                    // Process frames and score them (simplified scoring)
                    for (let i = 0; i < Math.min(frames.length, count); i++) {
                        const frameBase64 = frames[i].replace(/^data:image\/\w+;base64,/, "");
                        const frameBuffer = Buffer.from(frameBase64, "base64");
                        
                        bestFrames.push({
                            buffer: frameBuffer,
                            timestamp: i,
                            score: 100 - i, // Simple scoring
                        });
                    }
                } else {
                    throw new Error("External service failed");
                }
            } catch (error) {
                throw new Error(
                    "עיבוד וידאו נכשל. נא לוודא ש-Python MediaPipe מותקן או ש-RENDER_API_URL מוגדר."
                );
            }
        }
        
        return bestFrames;
    } finally {
        // Cleanup temp files
        await fs.rm(tempDir, { recursive: true, force: true });
    }
}

// Helper functions removed - using Python script instead

async function createMergedVideo(
    videoBuffer: Buffer,
    backgroundBuffer: Buffer,
    jobId: string
): Promise<Buffer> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "video-merge-"));
    const videoPath = path.join(tempDir, "input_video.mp4");
    const backgroundPath = path.join(tempDir, "background.jpg");
    const framesDir = path.join(tempDir, "frames");
    const mergedFramesDir = path.join(tempDir, "merged_frames");
    const outputPath = path.join(tempDir, "merged_video.mp4");
    
    try {
        // Write files to temp directory
        await fs.writeFile(videoPath, videoBuffer);
        await fs.writeFile(backgroundPath, backgroundBuffer);
        await fs.mkdir(framesDir, { recursive: true });
        await fs.mkdir(mergedFramesDir, { recursive: true });
        
        await supabaseAdmin
            .from("jobs")
            .update({ progress: 77 })
            .eq("id", jobId);
        
        // Use Python script for video merging with MediaPipe
        await supabaseAdmin
            .from("jobs")
            .update({ progress: 77 })
            .eq("id", jobId);
        
        const scriptPath = path.join(process.cwd(), "scripts", "video-processor.py");
        let stdout: string, stderr: string;
        let usePython = false;
        
        try {
            // Check if Python script exists
            await fs.access(scriptPath);
            
            // Try python3 first
            try {
                ({ stdout, stderr } = await execAsync(
                    `python3 "${scriptPath}" merge "${videoPath}" "${backgroundPath}" "${outputPath}"`
                ));
                usePython = true;
            } catch (error) {
                // Fallback to python
                try {
                    ({ stdout, stderr } = await execAsync(
                        `python "${scriptPath}" merge "${videoPath}" "${backgroundPath}" "${outputPath}"`
                    ));
                    usePython = true;
                } catch (fallbackError) {
                    console.log("Python not available for video merging");
                    usePython = false;
                }
            }
        } catch {
            console.log("Python script not found for video merging");
            usePython = false;
        }
        
        if (usePython) {
            // Parse progress from stderr and update job
            const progressLines = stderr.split("\n").filter((line: string) => line.startsWith("PROGRESS:"));
            for (const line of progressLines) {
                const progress = parseInt(line.split(":")[1]);
                // Map Python progress (0-100) to our range (77-95)
                const mappedProgress = 77 + Math.floor(progress * 0.18);
                await supabaseAdmin
                    .from("jobs")
                    .update({ progress: mappedProgress })
                    .eq("id", jobId);
            }
        } else {
            // Fallback: Use FFmpeg with chromakey (simpler but less accurate)
            await supabaseAdmin
                .from("jobs")
                .update({ progress: 85 })
                .eq("id", jobId);
            
            // Resize background to match video dimensions
            const { stdout: videoInfo } = await execAsync(
                `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of json "${videoPath}"`
            );
            const videoInfoJson = JSON.parse(videoInfo);
            const width = videoInfoJson.streams[0].width;
            const height = videoInfoJson.streams[0].height;
            
            const resizedBgPath = path.join(tempDir, "background_resized.jpg");
            await execAsync(
                `ffmpeg -i "${backgroundPath}" -vf scale=${width}:${height} "${resizedBgPath}" -y`
            );
            
            // Use FFmpeg overlay (simplified - doesn't use MediaPipe segmentation)
            // Note: This is a fallback and won't be as accurate as MediaPipe
            await execAsync(
                `ffmpeg -i "${videoPath}" -i "${resizedBgPath}" -filter_complex "[0:v][1:v]overlay=0:0" -c:v libx264 -pix_fmt yuv420p "${outputPath}" -y`
            );
            
            await supabaseAdmin
                .from("jobs")
                .update({ progress: 95 })
                .eq("id", jobId);
        }
        
        // Read merged video
        const mergedVideoBuffer = await fs.readFile(outputPath);
        
        return mergedVideoBuffer;
    } finally {
        // Cleanup temp files
        await fs.rm(tempDir, { recursive: true, force: true });
    }
}
