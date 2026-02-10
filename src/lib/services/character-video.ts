// src/lib/services/character-video.ts

import { generateWithLora } from "./modal";
import { enhancePrompt } from "./prompt-enhancer";
import { imageToVideo } from "./gemini";
import { supabaseAdmin } from "@/lib/supabase/admin";

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
}

interface VideoGenerationResult {
    videoUrl: string;
    thumbnailUrl: string;
    imageUrls: string[];
    sceneVideoUrls: string[];
    duration: number;
}

export async function generateCharacterVideo(
    options: GenerateCharacterVideoOptions,
    userId: string,
    jobId: string,
    onProgress: (progress: number) => Promise<void>
): Promise<VideoGenerationResult> {
    const {
        characterSettings,
        scenes,
        aspectRatio = "9:16",
        sceneDuration = 4,
    } = options;

    const totalScenes = scenes.length;
    const imageUrls: string[] = [];
    const sceneVideoUrls: string[] = [];

    // Calculate dimensions for Modal image generation
    let width = 1024,
        height = 1024;
    if (aspectRatio === "9:16") {
        width = 768;
        height = 1344;
    } else if (aspectRatio === "16:9") {
        width = 1344;
        height = 768;
    } else if (aspectRatio === "4:5") {
        width = 896;
        height = 1120;
    }

    const loraUrl = characterSettings?.lora_url;
    const triggerWord = characterSettings?.trigger_word || "ohwx";

    if (!loraUrl) {
        throw new Error("דמות לא מאומנת - חסר LoRA URL");
    }

    // ================================================================
    // PHASE 1: Generate character images via Modal (LoRA)
    // Progress: 15% → 45%
    // ================================================================

    for (let i = 0; i < totalScenes; i++) {
        const scene = scenes[i];
        const progressPercent = Math.round(15 + (i / totalScenes) * 30);
        await onProgress(progressPercent);

        try {
            // Enhance the scene prompt
            const enhancedPrompt = await enhancePrompt(scene.description);

            // Prepend trigger word if not already present
            let finalPrompt = enhancedPrompt;
            if (
                !finalPrompt
                    .toLowerCase()
                    .includes(triggerWord.toLowerCase())
            ) {
                finalPrompt = `${triggerWord} person, ${finalPrompt}`;
            }

            console.log(
                `[CharacterVideo] Scene ${i + 1}/${totalScenes} image prompt: "${finalPrompt.substring(0, 100)}..."`
            );

            // Generate with Modal LoRA
            const result = await generateWithLora({
                prompt: finalPrompt,
                modelUrl: loraUrl,
                triggerWord: triggerWord,
                width,
                height,
                numInferenceSteps: 28,
                guidanceScale: 3.5,
                loraScale: characterSettings?.lora_scale || 1.0,
            });

            if (!result.success || !result.image_url) {
                throw new Error(result.error || "Modal generation failed");
            }

            // Download and upload to Supabase Storage
            const imageResponse = await fetch(result.image_url);
            if (!imageResponse.ok) {
                throw new Error(
                    `Failed to download image: ${imageResponse.statusText}`
                );
            }
            const imageBuffer = Buffer.from(
                await imageResponse.arrayBuffer()
            );
            const fileName = `${userId}/${jobId}/scene_${i + 1}.png`;

            const { error: uploadError } = await supabaseAdmin.storage
                .from("content")
                .upload(fileName, imageBuffer, {
                    contentType: "image/png",
                    upsert: true,
                });

            if (uploadError) {
                throw new Error(
                    `Image upload failed: ${uploadError.message}`
                );
            }

            const { data: urlData } = supabaseAdmin.storage
                .from("content")
                .getPublicUrl(fileName);

            imageUrls.push(urlData.publicUrl);

            console.log(
                `[CharacterVideo] Scene ${i + 1} image uploaded: ${urlData.publicUrl}`
            );
        } catch (error) {
            console.error(
                `[CharacterVideo] Failed to generate image for scene ${i + 1}:`,
                error
            );
            throw new Error(
                `שגיאה ביצירת תמונה לסצנה ${i + 1}: ${error instanceof Error ? error.message : "Unknown"}`
            );
        }
    }

    if (imageUrls.length === 0) {
        throw new Error("לא נוצרו תמונות");
    }

    await onProgress(45);

    // ================================================================
    // PHASE 2: Generate video from each image using Veo 3
    // Progress: 45% → 92%
    // ================================================================

    for (let i = 0; i < imageUrls.length; i++) {
        const scene = scenes[i];
        const imageUrl = imageUrls[i];
        const duration = scene.duration || sceneDuration;
        const progressBase = Math.round(
            45 + (i / imageUrls.length) * 47
        );
        await onProgress(progressBase);

        try {
            // Build video prompt for Veo 3
            const videoPrompt = buildVideoPrompt(scene.description);

            console.log(
                `[CharacterVideo] Scene ${i + 1}/${imageUrls.length} video prompt: "${videoPrompt.substring(0, 100)}..."`
            );

            // Generate video via Veo 3 image-to-video
            const videoResult = await imageToVideo(imageUrl, videoPrompt, {
                aspectRatio,
                duration: duration >= 8 ? 8 : 4,
            });

            if (!videoResult) {
                throw new Error("Veo returned no video");
            }

            // Handle both data URI (base64) and regular URL
            let videoBuffer: Buffer;

            if (videoResult.startsWith("data:")) {
                // base64 data URI from Veo
                const base64Match = videoResult.match(
                    /^data:[^;]+;base64,(.+)$/
                );
                if (base64Match) {
                    videoBuffer = Buffer.from(base64Match[1], "base64");
                } else {
                    throw new Error("Invalid data URI from Veo");
                }
                console.log(
                    `[CharacterVideo] Scene ${i + 1}: Got base64 video (${(videoBuffer.length / 1024 / 1024).toFixed(1)}MB)`
                );
            } else {
                // Regular URL — download it
                console.log(
                    `[CharacterVideo] Scene ${i + 1}: Downloading video from URL: ${videoResult.substring(0, 100)}...`
                );
                const videoResponse = await fetch(videoResult);
                if (!videoResponse.ok) {
                    throw new Error(
                        `Failed to download video: ${videoResponse.status} ${videoResponse.statusText}`
                    );
                }
                videoBuffer = Buffer.from(
                    await videoResponse.arrayBuffer()
                );
                console.log(
                    `[CharacterVideo] Scene ${i + 1}: Downloaded video (${(videoBuffer.length / 1024 / 1024).toFixed(1)}MB)`
                );
            }

            // Upload to Supabase Storage
            const videoFileName = `${userId}/${jobId}/scene_${i + 1}_video.mp4`;

            const { error: uploadError } = await supabaseAdmin.storage
                .from("content")
                .upload(videoFileName, videoBuffer, {
                    contentType: "video/mp4",
                    upsert: true,
                });

            if (uploadError) {
                throw new Error(
                    `Video upload failed: ${uploadError.message}`
                );
            }

            const { data: videoUrlData } = supabaseAdmin.storage
                .from("content")
                .getPublicUrl(videoFileName);

            sceneVideoUrls.push(videoUrlData.publicUrl);

            console.log(
                `[CharacterVideo] Scene ${i + 1} video uploaded: ${videoUrlData.publicUrl}`
            );
        } catch (error) {
            console.error(
                `[CharacterVideo] Failed to generate video for scene ${i + 1}:`,
                error
            );
            throw new Error(
                `שגיאה ביצירת וידאו לסצנה ${i + 1}: ${error instanceof Error ? error.message : "Unknown"}`
            );
        }
    }

    await onProgress(95);

    // ================================================================
    // PHASE 3: Return results
    // ================================================================

    const totalDuration = scenes.reduce(
        (sum, s) => sum + (s.duration || sceneDuration),
        0
    );
    const finalVideoUrl = sceneVideoUrls[0];

    await onProgress(100);

    console.log(
        `[CharacterVideo] Job ${jobId} complete. ${imageUrls.length} images, ${sceneVideoUrls.length} videos.`
    );

    return {
        videoUrl: finalVideoUrl,
        thumbnailUrl: imageUrls[0],
        imageUrls,
        sceneVideoUrls,
        duration: totalDuration,
    };
}

/**
 * Build a cinematic video prompt from a scene description.
 */
function buildVideoPrompt(sceneDescription: string): string {
    return `Cinematic scene: ${sceneDescription}. Smooth natural movement, cinematic lighting, high quality, professional cinematography. The character moves naturally and expressively.`;
}