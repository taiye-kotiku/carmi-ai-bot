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
        sceneDuration = 5,
    } = options;

    const totalScenes = scenes.length;
    const imageUrls: string[] = [];
    const sceneVideoUrls: string[] = [];

    // Calculate dimensions (same logic as characters/generate-image)
    let width = 1024, height = 1024;
    if (aspectRatio === "9:16") { width = 768; height = 1344; }
    else if (aspectRatio === "16:9") { width = 1344; height = 768; }
    else if (aspectRatio === "4:5") { width = 896; height = 1120; }

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
            // Enhance the scene prompt (translate Hebrew, add quality terms)
            const enhancedPrompt = await enhancePrompt(scene.description);

            // Prepend trigger word if not already present
            let finalPrompt = enhancedPrompt;
            if (!finalPrompt.toLowerCase().includes(triggerWord.toLowerCase())) {
                finalPrompt = `${triggerWord} person, ${finalPrompt}`;
            }

            console.log(`[CharacterVideo] Scene ${i + 1} prompt: "${finalPrompt}"`);

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
                throw new Error(`Failed to download image: ${imageResponse.statusText}`);
            }
            const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
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

        } catch (error) {
            console.error(`[CharacterVideo] Failed to generate image for scene ${i + 1}:`, error);
            throw new Error(`שגיאה ביצירת תמונה לסצנה ${i + 1}: ${error instanceof Error ? error.message : "Unknown"}`);
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
        const progressBase = Math.round(45 + (i / imageUrls.length) * 47);
        await onProgress(progressBase);

        try {
            // Build video prompt for Veo 3
            const videoPrompt = buildVideoPrompt(scene.description);

            console.log(`[CharacterVideo] Scene ${i + 1} video prompt: "${videoPrompt}"`);

            // Generate video via Veo 3 image-to-video (from gemini.ts)
            const videoUri = await imageToVideo(imageUrl, videoPrompt, {
                aspectRatio,
                duration,
            });

            if (!videoUri) {
                throw new Error("Veo returned no video");
            }

            // Download and upload to Supabase Storage
            const videoResponse = await fetch(videoUri);
            if (!videoResponse.ok) {
                throw new Error(`Failed to download video: ${videoResponse.statusText}`);
            }

            const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
            const videoFileName = `${userId}/${jobId}/scene_${i + 1}_video.mp4`;

            const { error: uploadError } = await supabaseAdmin.storage
                .from("content")
                .upload(videoFileName, videoBuffer, {
                    contentType: "video/mp4",
                    upsert: true,
                });

            if (uploadError) {
                throw new Error(`Upload failed: ${uploadError.message}`);
            }

            const { data: videoUrlData } = supabaseAdmin.storage
                .from("content")
                .getPublicUrl(videoFileName);

            sceneVideoUrls.push(videoUrlData.publicUrl);

        } catch (error) {
            console.error(`[CharacterVideo] Failed to generate video for scene ${i + 1}:`, error);
            throw new Error(
                `שגיאה ביצירת וידאו לסצנה ${i + 1}: ${error instanceof Error ? error.message : "Unknown"}`
            );
        }
    }

    await onProgress(95);

    // ================================================================
    // PHASE 3: Return results
    // ================================================================

    const totalDuration = scenes.reduce((sum, s) => sum + (s.duration || sceneDuration), 0);
    const finalVideoUrl = sceneVideoUrls[0];

    await onProgress(100);

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
 * Keeps it concise for Veo 3 to interpret well.
 */
function buildVideoPrompt(sceneDescription: string): string {
    return `Cinematic scene: ${sceneDescription}. Smooth natural movement, cinematic lighting, high quality, professional cinematography. The character moves naturally and expressively.`;
}