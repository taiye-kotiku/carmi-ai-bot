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
import { FilesetResolver, ImageSegmenter } from "@mediapipe/tasks-vision";
import { createCanvas, loadImage, ImageData } from "@napi-rs/canvas";
import sharp from "sharp";

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

        // Validate file size (150MB max)
        if (videoFile.size > 150 * 1024 * 1024) {
            return NextResponse.json(
                { error: "גודל הקובץ חייב להיות עד 150MB" },
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
        
        // Extract frames using FFmpeg
        await supabaseAdmin
            .from("jobs")
            .update({ progress: 35 })
            .eq("id", jobId);
        
        // Extract frames at 1 FPS for analysis
        await execAsync(
            `ffmpeg -i "${videoPath}" -vf fps=1 "${framesDir}/frame_%06d.jpg" -y`
        );
        
        await supabaseAdmin
            .from("jobs")
            .update({ progress: 45 })
            .eq("id", jobId);
        
        // Get all extracted frames
        const frameFiles = (await fs.readdir(framesDir))
            .filter(f => f.endsWith(".jpg"))
            .sort();
        
        // Initialize MediaPipe Image Segmenter
        const wasmFileset = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
        );
        const imageSegmenter = await ImageSegmenter.createFromOptions(wasmFileset, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite",
                delegate: "GPU",
            },
            outputCategoryMask: true,
            outputConfidenceMasks: false,
        });
        
        await supabaseAdmin
            .from("jobs")
            .update({ progress: 50 })
            .eq("id", jobId);
        
        // Process frames and score them
        const candidates: Array<{
            buffer: Buffer;
            timestamp: number;
            score: number;
        }> = [];
        
        const totalFrames = frameFiles.length;
        for (let i = 0; i < frameFiles.length; i++) {
            const framePath = path.join(framesDir, frameFiles[i]);
            const frameBuffer = await fs.readFile(framePath);
            
            // Calculate sharpness using Laplacian variance
            const image = await sharp(frameBuffer).raw().toBuffer({ resolveWithObject: true });
            const sharpness = calculateSharpness(image.data, image.info.width, image.info.height);
            
            // Process with MediaPipe
            const canvas = createCanvas(image.info.width, image.info.height);
            const ctx = canvas.getContext("2d");
            const img = await loadImage(frameBuffer);
            ctx.drawImage(img, 0, 0);
            
            // Convert canvas to ImageData for MediaPipe
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const segmentationResult = imageSegmenter.segment(imageData);
            
            // Calculate segmentation quality
            const segmentationQuality = calculateSegmentationQualityFromResult(segmentationResult);
            
            // Check if has selfie (at least 10% of frame)
            const selfieArea = segmentationQuality.selfieArea;
            if (selfieArea > 0.1 && segmentationQuality.meanScore > 0.3) {
                // Combined score: sharpness + segmentation quality
                const score = sharpness * 0.6 + segmentationQuality.meanScore * 1000 * 0.4;
                
                // Estimate timestamp (1 frame per second)
                const timestamp = i;
                
                candidates.push({
                    buffer: frameBuffer,
                    timestamp,
                    score,
                });
            }
            
            // Update progress
            if (i % Math.max(1, Math.floor(totalFrames / 10)) === 0) {
                const progress = 50 + Math.floor((i / totalFrames) * 10);
                await supabaseAdmin
                    .from("jobs")
                    .update({ progress })
                    .eq("id", jobId);
            }
        }
        
        // Sort by score and take top N
        candidates.sort((a, b) => b.score - a.score);
        const bestFrames = candidates.slice(0, count);
        
        return bestFrames;
    } finally {
        // Cleanup temp files
        await fs.rm(tempDir, { recursive: true, force: true });
    }
}

function calculateSharpness(imageData: Buffer, width: number, height: number): number {
    // Laplacian variance calculation for sharpness
    // Convert RGB to grayscale and calculate variance
    let sum = 0;
    let sumSquared = 0;
    const pixelCount = width * height;
    
    // ImageData from sharp is RGBA format
    for (let i = 0; i < imageData.length; i += 4) {
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];
        const gray = (r * 0.299 + g * 0.587 + b * 0.114);
        sum += gray;
        sumSquared += gray * gray;
    }
    
    const mean = sum / pixelCount;
    const variance = (sumSquared / pixelCount) - (mean * mean);
    
    return variance;
}

function calculateSegmentationQualityFromResult(segmentationResult: any): {
    meanScore: number;
    selfieArea: number;
} {
    if (!segmentationResult.categoryMask) {
        return { meanScore: 0, selfieArea: 0 };
    }
    
    const mask = segmentationResult.categoryMask;
    let selfiePixels = 0;
    const totalPixels = mask.length;
    
    // Category mask: 255 for selfie, 0 for background
    for (let i = 0; i < mask.length; i++) {
        if (mask[i] === 255) {
            selfiePixels++;
        }
    }
    
    const selfieArea = selfiePixels / totalPixels;
    const meanScore = selfieArea; // Use area as quality score
    
    return {
        meanScore,
        selfieArea,
    };
}

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
        
        // Extract all frames from video
        await execAsync(
            `ffmpeg -i "${videoPath}" "${framesDir}/frame_%06d.jpg" -y`
        );
        
        await supabaseAdmin
            .from("jobs")
            .update({ progress: 80 })
            .eq("id", jobId);
        
        // Initialize MediaPipe Image Segmenter
        const wasmFileset = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
        );
        const imageSegmenter = await ImageSegmenter.createFromOptions(wasmFileset, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite",
                delegate: "GPU",
            },
            outputCategoryMask: true,
            outputConfidenceMasks: false,
        });
        
        // Load background image
        const bgImage = await loadImage(backgroundBuffer);
        const bgCanvas = createCanvas(bgImage.width, bgImage.height);
        const bgCtx = bgCanvas.getContext("2d");
        bgCtx.drawImage(bgImage, 0, 0);
        
        // Process each frame
        const frameFiles = (await fs.readdir(framesDir))
            .filter(f => f.endsWith(".jpg"))
            .sort();
        
        const totalFrames = frameFiles.length;
        for (let i = 0; i < frameFiles.length; i++) {
            const framePath = path.join(framesDir, frameFiles[i]);
            const frameBuffer = await fs.readFile(framePath);
            
            // Load frame
            const frameImage = await loadImage(frameBuffer);
            const canvas = createCanvas(frameImage.width, frameImage.height);
            const ctx = canvas.getContext("2d");
            ctx.drawImage(frameImage, 0, 0);
            
            // Get segmentation mask
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const segmentationResult = imageSegmenter.segment(imageData);
            
            // Create merged frame
            const mergedCanvas = createCanvas(frameImage.width, frameImage.height);
            const mergedCtx = mergedCanvas.getContext("2d");
            
            // Draw background (resized to frame size)
            mergedCtx.drawImage(bgImage, 0, 0, frameImage.width, frameImage.height);
            
            // Draw foreground where mask is true
            const mergedData = mergedCtx.getImageData(0, 0, mergedCanvas.width, mergedCanvas.height);
            const categoryMask = segmentationResult.categoryMask;
            
            if (categoryMask) {
                for (let j = 0; j < imageData.data.length; j += 4) {
                    const pixelIndex = j / 4;
                    const maskValue = categoryMask[pixelIndex];
                    
                    if (maskValue === 255) {
                        // Use foreground pixel (selfie detected)
                        mergedData.data[j] = imageData.data[j];
                        mergedData.data[j + 1] = imageData.data[j + 1];
                        mergedData.data[j + 2] = imageData.data[j + 2];
                        mergedData.data[j + 3] = 255;
                    }
                }
            }
            
            mergedCtx.putImageData(mergedData, 0, 0);
            
            // Save merged frame
            const mergedFrameBuffer = mergedCanvas.toBuffer("image/jpeg");
            const mergedFramePath = path.join(mergedFramesDir, frameFiles[i]);
            await fs.writeFile(mergedFramePath, mergedFrameBuffer);
            
            // Update progress
            if (i % Math.max(1, Math.floor(totalFrames / 10)) === 0) {
                const progress = 80 + Math.floor((i / totalFrames) * 15);
                await supabaseAdmin
                    .from("jobs")
                    .update({ progress })
                    .eq("id", jobId);
            }
        }
        
        await supabaseAdmin
            .from("jobs")
            .update({ progress: 95 })
            .eq("id", jobId);
        
        // Get video FPS
        const { stdout: fpsOutput } = await execAsync(
            `ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`
        );
        const fps = fpsOutput.trim().split("/").reduce((a: number, b: string) => Number(a) / Number(b), 1) || 30;
        
        // Combine frames back into video
        await execAsync(
            `ffmpeg -framerate ${fps} -i "${mergedFramesDir}/frame_%06d.jpg" -c:v libx264 -pix_fmt yuv420p "${outputPath}" -y`
        );
        
        // Read merged video
        const mergedVideoBuffer = await fs.readFile(outputPath);
        
        return mergedVideoBuffer;
    } finally {
        // Cleanup temp files
        await fs.rm(tempDir, { recursive: true, force: true });
    }
}
