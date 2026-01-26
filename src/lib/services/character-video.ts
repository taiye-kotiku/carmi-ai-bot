// src/lib/services/character-video.ts
import { generateWithCharacter, downloadImage } from "./fal";
import { createVideoFromImages, addAudioToVideo } from "./render-video";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { nanoid } from "nanoid";

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
    audioUrl?: string;
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
        audioUrl,
    } = options;

    const totalScenes = scenes.length;
    const imageUrls: string[] = [];

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

    // Step 2: Create video using Render API
    const videoResult = await createVideoFromImages({
        imageUrls,
        sceneDuration,
        transitionStyle,
        transitionDuration: 0.5,
        aspectRatio,
        fps,
    });

    if (!videoResult.success || !videoResult.video_base64) {
        throw new Error(videoResult.error || "שגיאה ביצירת הסרטון");
    }

    await onProgress(80);

    // Step 3: Add audio if provided
    let finalVideoBase64 = videoResult.video_base64;

    if (audioUrl) {
        const audioResult = await addAudioToVideo({
            videoBase64: videoResult.video_base64,
            audioUrl,
            duration: videoResult.duration,
        });

        if (audioResult.success && audioResult.video_base64) {
            finalVideoBase64 = audioResult.video_base64;
        }
    }

    await onProgress(90);

    // Step 4: Upload video to Supabase
    const videoBuffer = Buffer.from(finalVideoBase64, 'base64');
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

    return {
        videoUrl: videoUrlData.publicUrl,
        thumbnailUrl: imageUrls[0],
        imageUrls,
        duration: videoResult.duration || scenes.length * sceneDuration,
    };
}