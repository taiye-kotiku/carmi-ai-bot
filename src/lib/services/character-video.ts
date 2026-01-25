// src/lib/services/character-video.ts
import { generateWithCharacter, downloadImage } from "./fal";
import { createVideoFromImages } from "./ffmpeg-video";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { nanoid } from "nanoid";
import path from "path";
import fs from "fs/promises";
import os from "os";

interface CharacterScene {
    description: string;
    duration?: number;
}

interface GenerateCharacterVideoOptions {
    characterId: string;
    characterReferenceImages: string[];
    characterSettings: any;
    scenes: CharacterScene[];
    aspectRatio?: string;
    transitionStyle?: "fade" | "slide" | "zoom" | "none";
    sceneDuration?: number;
    fps?: number;
}

interface VideoGenerationResult {
    videoUrl: string;
    thumbnailUrl: string;
    imageUrls: string[];
    duration: number;
}

export async function generateCharacterVideo(
    options: GenerateCharacterVideoOptions,
    userId: string,
    jobId: string,
    onProgress: (progress: number) => Promise<void>
): Promise<VideoGenerationResult> {
    const {
        characterReferenceImages,
        characterSettings,
        scenes,
        aspectRatio = "9:16",
        transitionStyle = "fade",
        sceneDuration = 3,
        fps = 30,
    } = options;

    const totalScenes = scenes.length;
    const imageUrls: string[] = [];
    const tempDir = path.join(os.tmpdir(), `char-video-${jobId}`);

    // Create temp directory
    await fs.mkdir(tempDir, { recursive: true });

    try {
        // Step 1: Generate all character images (60% of progress)
        for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i];
            const progressPercent = Math.round(10 + (i / totalScenes) * 50);
            await onProgress(progressPercent);

            try {
                const result = await generateWithCharacter({
                    prompt: scene.description,
                    referenceImages: characterReferenceImages,
                    model: characterSettings?.model || "pulid",
                    aspectRatio,
                    ipAdapterScale: characterSettings?.ip_adapter_scale || 0.8,
                });

                if (result.images.length > 0) {
                    // Download and upload to Supabase
                    const imageBuffer = await downloadImage(result.images[0]);
                    const fileName = `${userId}/${jobId}/scene_${i + 1}.png`;

                    await supabaseAdmin.storage
                        .from("content")
                        .upload(fileName, imageBuffer, {
                            contentType: "image/png",
                            upsert: true,
                        });

                    const { data: urlData } = supabaseAdmin.storage
                        .from("content")
                        .getPublicUrl(fileName);

                    imageUrls.push(urlData.publicUrl);
                }
            } catch (error) {
                console.error(`Failed to generate scene ${i + 1}:`, error);
                throw new Error(`שגיאה ביצירת סצנה ${i + 1}`);
            }
        }

        if (imageUrls.length === 0) {
            throw new Error("לא נוצרו תמונות");
        }

        await onProgress(65);

        // Step 2: Create video using FFmpeg
        const videoOutputPath = path.join(tempDir, "output.mp4");

        await createVideoFromImages({
            imageUrls,
            outputPath: videoOutputPath,
            sceneDuration,
            transitionStyle,
            aspectRatio,
            fps,
        });

        await onProgress(85);

        // Step 3: Upload video to Supabase
        const videoBuffer = await fs.readFile(videoOutputPath);
        const videoFileName = `${userId}/${jobId}/character_video.mp4`;

        const { error: uploadError } = await supabaseAdmin.storage
            .from("content")
            .upload(videoFileName, videoBuffer, {
                contentType: "video/mp4",
                upsert: true,
            });

        if (uploadError) {
            throw new Error("שגיאה בהעלאת הסרטון");
        }

        const { data: videoUrlData } = supabaseAdmin.storage
            .from("content")
            .getPublicUrl(videoFileName);

        await onProgress(100);

        // Calculate total duration
        const totalDuration = scenes.length * sceneDuration;

        return {
            videoUrl: videoUrlData.publicUrl,
            thumbnailUrl: imageUrls[0],
            imageUrls,
            duration: totalDuration,
        };
    } finally {
        // Clean up temp directory
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch (e) {
            console.warn("Failed to clean up temp directory:", e);
        }
    }
}