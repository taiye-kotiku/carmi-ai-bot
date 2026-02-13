// src/lib/services/job-processor.ts
// Processes jobs that are still "processing" when polled

import { supabaseAdmin } from "@/lib/supabase/admin";
import { addCredits } from "@/lib/services/credits";
import { CREDIT_COSTS } from "@/lib/config/credits";
import { updateUserStorage } from "@/lib/services/storage";
import { nanoid } from "nanoid";

const apiKey = process.env.GOOGLE_AI_API_KEY!;

/**
 * Try to advance a processing job.
 * Returns the updated job status.
 * Each call should complete within ~8 seconds.
 */
export async function processJob(job: any, userId: string): Promise<{
    status: string;
    progress: number;
    result: any;
    error: string | null;
}> {
    const jobType = job.type;
    const jobData = job.result as any;

    try {
        switch (jobType) {
            case "text_to_video":
                return await processTextToVideo(job, userId, jobData);

            case "image_to_video":
                return await processImageToVideo(job, userId, jobData);

            case "generate_image":
            case "edit_image":
                return await processImage(job, userId, jobData);

            case "character_image":
                return await processCharacterImage(job, userId, jobData);

            case "character_video":
                return await processCharacterVideo(job, userId, jobData);

            case "carousel":
                return await processCarousel(job, userId, jobData);

            case "convert_reel":
                return await processReel(job, userId, jobData);

            case "video_clips":
                return await processVideoClips(job, userId, jobData);

            default:
                return {
                    status: job.status,
                    progress: job.progress,
                    result: job.result,
                    error: job.error,
                };
        }
    } catch (error: any) {
        console.error(`[JobProcessor] Error processing ${jobType}:`, error);
        return {
            status: job.status,
            progress: job.progress,
            result: null,
            error: null,
        };
    }
}

// ─── TEXT TO VIDEO (Veo polling) ───
async function processTextToVideo(job: any, userId: string, jobData: any) {
    const operationName = jobData?.operationName;
    if (!operationName) {
        return { status: "failed", progress: 0, result: null, error: "No operation name" };
    }

    const pollResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`
    );

    if (!pollResponse.ok) {
        return { status: "processing", progress: job.progress, result: null, error: null };
    }

    const pollData = await pollResponse.json();

    if (!pollData.done) {
        const elapsed = (Date.now() - new Date(job.created_at).getTime()) / 1000;
        const progress = Math.min(75, Math.round(10 + (elapsed / 180) * 65));
        await supabaseAdmin.from("jobs").update({ progress }).eq("id", job.id);
        return { status: "processing", progress, result: null, error: null };
    }

    if (pollData.error) {
        await failJob(job.id, userId, CREDIT_COSTS.video_generation, pollData.error.message, "החזר - יצירת וידאו נכשלה");
        return { status: "failed", progress: 0, result: null, error: pollData.error.message };
    }

    const videoUri =
        pollData.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
        pollData.response?.generatedSamples?.[0]?.video?.uri ||
        pollData.response?.videos?.[0]?.uri;

    if (!videoUri) {
        await failJob(job.id, userId, CREDIT_COSTS.video_generation, "No video URL", "החזר - וידאו ללא URL");
        return { status: "failed", progress: 0, result: null, error: "No video URL in response" };
    }

    // Download and upload
    const downloadUrl = videoUri.includes("?") ? `${videoUri}&key=${apiKey}` : `${videoUri}?key=${apiKey}`;
    const videoResponse = await fetch(downloadUrl);
    if (!videoResponse.ok) {
        await failJob(job.id, userId, CREDIT_COSTS.video_generation, "Download failed", "החזר - הורדת וידאו נכשלה");
        return { status: "failed", progress: 0, result: null, error: "Video download failed" };
    }

    const videoBuffer = await videoResponse.arrayBuffer();
    if (videoBuffer.byteLength < 50000) {
        await failJob(job.id, userId, CREDIT_COSTS.video_generation, "Video too small", "החזר - וידאו לא תקין");
        return { status: "failed", progress: 0, result: null, error: "Invalid video file" };
    }

    const fileName = `videos/${userId}/${Date.now()}.mp4`;
    await supabaseAdmin.storage.from("generations").upload(fileName, videoBuffer, { contentType: "video/mp4", upsert: true });
    const { data: { publicUrl } } = supabaseAdmin.storage.from("generations").getPublicUrl(fileName);

    const generationId = nanoid();
    await supabaseAdmin.from("generations").insert({
        id: generationId, user_id: userId, type: "video", feature: "text_to_video",
        prompt: jobData.prompt || "", result_urls: [publicUrl], status: "completed",
        completed_at: new Date().toISOString(), file_size_bytes: videoBuffer.byteLength,
        files_deleted: false, job_id: job.id,
    });

    await updateUserStorage(userId, videoBuffer.byteLength);
    await completeJob(job.id, { videoUrl: publicUrl });

    return { status: "completed", progress: 100, result: { videoUrl: publicUrl }, error: null };
}

// ─── IMAGE TO VIDEO (Veo polling) ───
async function processImageToVideo(job: any, userId: string, jobData: any) {
    const operationName = jobData?.operationName;

    // Phase 1: Start the generation if not started yet
    if (!operationName && jobData?.imageBase64) {
        const { enhancePrompt } = await import("@/lib/services/gemini");
        const { imageToVideo: geminiImageToVideo } = await import("@/lib/services/gemini");

        let finalPrompt = jobData.prompt || "Animate this image with subtle movement, cinematic quality";
        if (jobData.prompt) {
            try { finalPrompt = await enhancePrompt(jobData.prompt, "video"); } catch { }
        }

        // Start Veo with image
        const startResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/veo-3.0-fast-generate-001:predictLongRunning?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    instances: [{
                        prompt: finalPrompt,
                        image: { bytesBase64Encoded: jobData.imageBase64 },
                    }],
                    parameters: { sampleCount: 1 },
                }),
            }
        );

        if (!startResponse.ok) {
            await failJob(job.id, userId, CREDIT_COSTS.video_generation, "Veo start failed", "החזר - יצירת וידאו מתמונה נכשלה");
            return { status: "failed", progress: 0, result: null, error: "Video generation start failed" };
        }

        const operation = await startResponse.json();
        await supabaseAdmin.from("jobs").update({
            progress: 20,
            result: { ...jobData, operationName: operation.name },
        }).eq("id", job.id);

        return { status: "processing", progress: 20, result: null, error: null };
    }

    // Phase 2: Poll for completion (same as text-to-video)
    if (operationName) {
        const result = await processTextToVideo(job, userId, {
            ...jobData,
            operationName,
        });
        return result;
    }

    return { status: "processing", progress: job.progress, result: null, error: null };
}

// ─── IMAGE GENERATION ───
async function processImage(job: any, userId: string, jobData: any) {
    // Image gen is fast enough to run inline during the first poll
    // But if it's already completed/failed, just return
    if (job.status === "completed" || job.status === "failed") {
        return { status: job.status, progress: job.progress, result: job.result, error: job.error };
    }

    // The image generation should have been handled by the POST endpoint
    // If we're here and still processing, it means the background fn was killed
    // We need to re-run it
    const params = jobData?.params;
    if (!params) {
        return { status: job.status, progress: job.progress, result: job.result, error: job.error };
    }

    try {
        const parts: any[] = [];
        if (params.imageBase64 && params.imageMimeType) {
            parts.push({ inlineData: { mimeType: params.imageMimeType, data: params.imageBase64 } });
            parts.push({ text: buildEditPrompt(params.prompt, params.style) });
        } else {
            parts.push({ text: buildEnhancedPrompt(params.prompt, params.style, params.aspectRatio) });
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts }],
                    generationConfig: { responseModalities: ["Text", "Image"] },
                }),
            }
        );

        if (!response.ok) throw new Error("Gemini API failed");

        const data = await response.json();
        const imagePart = data.candidates?.[0]?.content?.parts?.find(
            (p: any) => p.inlineData?.mimeType?.startsWith("image/")
        );
        if (!imagePart) throw new Error("No image generated");

        const buffer = Buffer.from(imagePart.inlineData.data, "base64");
        const fileName = `${userId}/${job.id}.png`;
        await supabaseAdmin.storage.from("content").upload(fileName, buffer, { contentType: "image/png", upsert: true });
        const { data: urlData } = supabaseAdmin.storage.from("content").getPublicUrl(fileName);

        const generationId = nanoid();
        await supabaseAdmin.from("generations").insert({
            id: generationId, user_id: userId, type: "image",
            feature: params.imageBase64 ? "edit_image" : "generate_image",
            prompt: params.prompt, result_urls: [urlData.publicUrl],
            thumbnail_url: urlData.publicUrl, status: "completed",
            job_id: job.id, completed_at: new Date().toISOString(),
            file_size_bytes: buffer.length, files_deleted: false,
        });

        await updateUserStorage(userId, buffer.length);
        await completeJob(job.id, { url: urlData.publicUrl });

        return { status: "completed", progress: 100, result: { url: urlData.publicUrl }, error: null };
    } catch (error: any) {
        await failJob(job.id, userId, CREDIT_COSTS.image_generation, error.message, "החזר - יצירת תמונה נכשלה");
        return { status: "failed", progress: 0, result: null, error: error.message };
    }
}

// ─── CHARACTER IMAGE ───
async function processCharacterImage(job: any, userId: string, jobData: any) {
    if (job.status === "completed" || job.status === "failed") {
        return { status: job.status, progress: job.progress, result: job.result, error: job.error };
    }

    const params = jobData?.params;
    if (!params) {
        return { status: job.status, progress: job.progress, result: job.result, error: job.error };
    }

    try {
        const { fal } = await import("@fal-ai/client");
        fal.config({ credentials: process.env.FAL_KEY });

        const imageSizeMap: Record<string, string> = {
            "1:1": "square", "16:9": "landscape_16_9", "9:16": "portrait_16_9",
            "4:3": "landscape_4_3", "3:4": "portrait_4_3",
        };

        const result = await fal.subscribe("fal-ai/flux-lora", {
            input: {
                prompt: params.fullPrompt,
                loras: [{ path: params.loraUrl, scale: 0.9 }],
                image_size: imageSizeMap[params.aspectRatio] || "square",
                num_images: Math.min(params.numImages || 1, 4),
                output_format: "jpeg",
                guidance_scale: 3.5,
                num_inference_steps: 28,
                enable_safety_checker: false,
            },
        });

        const images = result.data.images?.map((img: any) => img.url) || [];
        if (images.length === 0) throw new Error("No images generated");

        const uploadedUrls: string[] = [];
        let totalFileSize = 0;

        for (let i = 0; i < images.length; i++) {
            const imgResponse = await fetch(images[i]);
            const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
            totalFileSize += imgBuffer.length;

            const fileName = `${userId}/${nanoid()}/character_${i + 1}.jpg`;
            const { error: uploadError } = await supabaseAdmin.storage.from("content")
                .upload(fileName, imgBuffer, { contentType: "image/jpeg", upsert: true });

            if (!uploadError) {
                const { data: urlData } = supabaseAdmin.storage.from("content").getPublicUrl(fileName);
                uploadedUrls.push(urlData.publicUrl);
            } else {
                uploadedUrls.push(images[i]);
            }
        }

        const generationId = nanoid();
        await supabaseAdmin.from("generations").insert({
            id: generationId, user_id: userId, type: "image", feature: "character_image",
            prompt: params.fullPrompt, result_urls: uploadedUrls,
            thumbnail_url: uploadedUrls[0], status: "completed",
            completed_at: new Date().toISOString(), character_id: params.characterId,
            file_size_bytes: totalFileSize, files_deleted: false, job_id: job.id,
        });

        if (totalFileSize > 0) await updateUserStorage(userId, totalFileSize);
        await completeJob(job.id, { images: uploadedUrls });

        return { status: "completed", progress: 100, result: { images: uploadedUrls }, error: null };
    } catch (error: any) {
        await failJob(job.id, userId, CREDIT_COSTS.image_generation, error.message, "החזר - יצירת תמונת דמות נכשלה");
        return { status: "failed", progress: 0, result: null, error: error.message };
    }
}

// ─── CHARACTER VIDEO ───
async function processCharacterVideo(job: any, userId: string, jobData: any) {
    // Character video is complex and multi-step
    // For now, return current status — this needs the Pro plan for after()
    // On Hobby, we mark it as needing upgrade
    if (job.status === "processing") {
        const elapsed = (Date.now() - new Date(job.created_at).getTime()) / 1000;
        if (elapsed > 600) {
            await failJob(job.id, userId, CREDIT_COSTS.video_generation, "Timeout", "החזר - יצירת וידאו דמות נכשלה");
            return { status: "failed", progress: 0, result: null, error: "Generation timed out" };
        }
    }
    return { status: job.status, progress: job.progress, result: job.result, error: job.error };
}

// ─── CAROUSEL ───
async function processCarousel(job: any, userId: string, jobData: any) {
    if (job.status === "completed" || job.status === "failed") {
        return { status: job.status, progress: job.progress, result: job.result, error: job.error };
    }

    const params = jobData?.params;
    if (!params) {
        return { status: job.status, progress: job.progress, result: job.result, error: job.error };
    }

    try {
        const { generateCarousel } = await import("@/lib/services/carousel");
        const { generateCarouselContent } = await import("@/lib/services/carousel-content");

        let slides = params.customSlides;

        if (!slides?.length && params.topic) {
            slides = await generateCarouselContent({
                topic: params.topic,
                slideCount: params.slideCount || 5,
                style: params.style || "educational",
                language: "he",
            });
        }

        if (!slides?.length) throw new Error("No slides content");

        await supabaseAdmin.from("jobs").update({ progress: 40 }).eq("id", job.id);

        const result = await generateCarousel({
            slides,
            templateId: params.templateId,
            logoUrl: params.brandLogo,
            logoBase64: params.logoBase64,
            brandColor: params.brandColor,
            logoPosition: params.logoPosition,
            logoSize: params.logoSize,
            logoTransparent: params.logoTransparent,
            fontFamily: params.fontFamily,
            headlineFontSize: params.headlineFontSize,
            bodyFontSize: params.bodyFontSize,
            fontColor: params.fontColor,
            customBackgroundBase64: params.customBackgroundBase64,
        });

        await supabaseAdmin.from("jobs").update({ progress: 70 }).eq("id", job.id);

        const uploadedUrls: string[] = [];
        let totalFileSize = 0;

        for (let i = 0; i < result.images.length; i++) {
            const imageBuffer = result.images[i];
            totalFileSize += imageBuffer.length;
            const fileName = `${userId}/${job.id}/slide_${i + 1}.png`;
            const { error: uploadError } = await supabaseAdmin.storage.from("content")
                .upload(fileName, imageBuffer, { contentType: "image/png", upsert: true });
            if (!uploadError) {
                const { data: urlData } = supabaseAdmin.storage.from("content").getPublicUrl(fileName);
                uploadedUrls.push(urlData.publicUrl);
            }
        }

        const generationId = nanoid();
        await supabaseAdmin.from("generations").insert({
            id: generationId, user_id: userId, type: "carousel", feature: "carousel_generation",
            prompt: params.topic || slides.join(" | "), result_urls: uploadedUrls,
            thumbnail_url: uploadedUrls[0], status: "completed", job_id: job.id,
            has_branding: !!params.brandLogo, completed_at: new Date().toISOString(),
            file_size_bytes: totalFileSize, files_deleted: false,
        });

        if (totalFileSize > 0) await updateUserStorage(userId, totalFileSize);
        await completeJob(job.id, { images: uploadedUrls, slides, template: params.templateId });

        return { status: "completed", progress: 100, result: { images: uploadedUrls, slides }, error: null };
    } catch (error: any) {
        await failJob(job.id, userId, CREDIT_COSTS.carousel_generation, error.message, "החזר - יצירת קרוסלה נכשלה");
        return { status: "failed", progress: 0, result: null, error: error.message };
    }
}

// ─── REEL ───
async function processReel(job: any, userId: string, jobData: any) {
    if (job.status === "completed" || job.status === "failed") {
        return { status: job.status, progress: job.progress, result: job.result, error: job.error };
    }

    const params = jobData?.params;
    if (!params?.url) {
        return { status: job.status, progress: job.progress, result: job.result, error: job.error };
    }

    try {
        const { extractReelFrames } = await import("@/lib/services/reel-extractor");
        const sharp = (await import("sharp")).default;

        const extractedFrames = await extractReelFrames(params.url, 10);
        await supabaseAdmin.from("jobs").update({ progress: 50 }).eq("id", job.id);

        const uploadedFrames: any[] = [];
        let totalFileSize = 0;

        for (let i = 0; i < extractedFrames.length; i++) {
            const frame = extractedFrames[i];
            let buffer: Buffer;

            if (frame.url.startsWith("data:image")) {
                buffer = Buffer.from(frame.url.split(",")[1], "base64");
            } else {
                const frameResponse = await fetch(frame.url);
                buffer = Buffer.from(await frameResponse.arrayBuffer());
            }

            try {
                const metadata = await sharp(buffer).metadata();
                if (metadata.width && metadata.height && (metadata.width < 1080 || metadata.height < 1080)) {
                    buffer = await sharp(buffer).resize(1080, 1080, { fit: "cover" }).jpeg({ quality: 95 }).toBuffer();
                } else {
                    buffer = await sharp(buffer).jpeg({ quality: 95 }).toBuffer();
                }
            } catch { }

            totalFileSize += buffer.length;
            const fileName = `${userId}/${job.id}/frame_${i + 1}.jpg`;
            const { error: uploadError } = await supabaseAdmin.storage.from("content")
                .upload(fileName, buffer, { contentType: "image/jpeg", upsert: true });

            if (!uploadError) {
                const { data: urlData } = supabaseAdmin.storage.from("content").getPublicUrl(fileName);
                uploadedFrames.push({ url: urlData.publicUrl, timestamp: frame.timestamp });
            }
        }

        const generationId = nanoid();
        await supabaseAdmin.from("generations").insert({
            id: generationId, user_id: userId, type: "reel", feature: "convert_reel",
            source_url: params.url, result_urls: uploadedFrames.map((f: any) => f.url),
            thumbnail_url: uploadedFrames[0]?.url, status: "completed", job_id: job.id,
            completed_at: new Date().toISOString(), file_size_bytes: totalFileSize, files_deleted: false,
        });

        if (totalFileSize > 0) await updateUserStorage(userId, totalFileSize);
        await completeJob(job.id, { frames: uploadedFrames });

        return { status: "completed", progress: 100, result: { frames: uploadedFrames }, error: null };
    } catch (error: any) {
        await failJob(job.id, userId, CREDIT_COSTS.video_generation, error.message, "החזר - המרת רילז נכשלה");
        return { status: "failed", progress: 0, result: null, error: error.message };
    }
}

// ─── VIDEO CLIPS ───
async function processVideoClips(job: any, userId: string, jobData: any) {
    // Video clips uses external Vizard API which is also long-running
    // Check if we have a projectId to poll
    if (job.status === "completed" || job.status === "failed") {
        return { status: job.status, progress: job.progress, result: job.result, error: job.error };
    }

    const elapsed = (Date.now() - new Date(job.created_at).getTime()) / 1000;
    if (elapsed > 600) {
        await failJob(job.id, userId, CREDIT_COSTS.video_clips, "Timeout", "החזר - חיתוך וידאו נכשל");
        return { status: "failed", progress: 0, result: null, error: "Processing timed out" };
    }

    return { status: job.status, progress: job.progress, result: job.result, error: job.error };
}

// ─── HELPERS ───
async function completeJob(jobId: string, result: any) {
    await supabaseAdmin.from("jobs").update({
        status: "completed", progress: 100, result,
    }).eq("id", jobId);
}

async function failJob(jobId: string, userId: string, creditAmount: number, errorMsg: string, refundReason: string) {
    await supabaseAdmin.from("jobs").update({
        status: "failed", error: errorMsg, progress: 0,
    }).eq("id", jobId);
    await addCredits(userId, creditAmount, refundReason, jobId);
}

function buildEditPrompt(prompt: string, style: string): string {
    const stylePrompts: Record<string, string> = {
        realistic: "photorealistic, highly detailed",
        artistic: "artistic, creative, painterly",
        cartoon: "cartoon style, animated, colorful",
        minimal: "minimalist, clean, modern",
    };
    return `Edit this image: ${prompt}. ${stylePrompts[style] ? `Style: ${stylePrompts[style]}.` : ""} Keep the overall composition and produce a high-quality result.`;
}

function buildEnhancedPrompt(prompt: string, style: string, aspectRatio: string): string {
    const stylePrompts: Record<string, string> = {
        realistic: "photorealistic, highly detailed, professional photography",
        artistic: "artistic, creative, painterly, beautiful colors",
        cartoon: "cartoon style, animated, colorful, fun",
        minimal: "minimalist, clean, simple, modern design",
    };
    const ratioHints: Record<string, string> = {
        "1:1": "square composition", "16:9": "wide landscape composition",
        "9:16": "vertical portrait composition", "4:3": "classic 4:3 composition",
    };
    return `Create an image: ${prompt}. Style: ${stylePrompts[style] || ""}. ${ratioHints[aspectRatio] || ""}. High quality, professional.`;
}