// src/lib/services/job-processor.ts

import { supabaseAdmin } from "@/lib/supabase/admin";
import { addCredits } from "@/lib/services/credits";
import { CREDIT_COSTS } from "@/lib/config/credits";
import { updateUserStorage } from "@/lib/services/storage";
import { nanoid } from "nanoid";

const apiKey = process.env.GOOGLE_AI_API_KEY!;

/**
 * Try to advance a processing job one step.
 * Each call completes within ~8 seconds.
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
                return await processCharacterVideoStep(job, userId, jobData);
            case "carousel":
                return await processCarousel(job, userId, jobData);
            case "convert_reel":
                return await processReel(job, userId, jobData);
            case "video_clips":
                return await processVideoClipsStep(job, userId, jobData);
            default:
                return currentStatus(job);
        }
    } catch (error: any) {
        console.error(`[JobProcessor] Error processing ${jobType}:`, error);
        return currentStatus(job);
    }
}

// ─────────────────────────────────────────────
// TEXT TO VIDEO (Veo polling)
// ─────────────────────────────────────────────
async function processTextToVideo(job: any, userId: string, jobData: any) {
    const operationName = jobData?.operationName;
    if (!operationName) {
        return { status: "failed", progress: 0, result: null, error: "No operation name" };
    }

    const pollResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`
    );
    if (!pollResponse.ok) return stillProcessing(job);

    const pollData = await pollResponse.json();

    if (!pollData.done) {
        const progress = estimateProgress(job, 180);
        await updateProgress(job.id, progress);
        return { status: "processing", progress, result: null, error: null };
    }

    if (pollData.error) {
        await failJob(job.id, userId, CREDIT_COSTS.video_generation, pollData.error.message, "החזר - יצירת וידאו נכשלה");
        return { status: "failed", progress: 0, result: null, error: pollData.error.message };
    }

    const videoUri = extractVideoUri(pollData);
    if (!videoUri) {
        await failJob(job.id, userId, CREDIT_COSTS.video_generation, "No video URL", "החזר - וידאו ללא URL");
        return { status: "failed", progress: 0, result: null, error: "No video URL" };
    }

    return await downloadAndSaveVideo(job, userId, videoUri, "text_to_video", jobData.prompt || "");
}

// ─────────────────────────────────────────────
// IMAGE TO VIDEO (start Veo then poll)
// ─────────────────────────────────────────────
async function processImageToVideo(job: any, userId: string, jobData: any) {
    const operationName = jobData?.operationName;

    // Phase 1: Start Veo if not started
    if (!operationName && jobData?.imageBase64) {
        const { enhancePrompt } = await import("@/lib/services/gemini");

        let finalPrompt = jobData.prompt || "Animate this image with subtle movement, cinematic quality";
        if (jobData.prompt) {
            try { finalPrompt = await enhancePrompt(jobData.prompt, "video"); } catch { }
        }

        // Download image and start Veo
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
            return { status: "failed", progress: 0, result: null, error: "Video start failed" };
        }

        const operation = await startResponse.json();
        // Save operation name, remove heavy base64 data
        await supabaseAdmin.from("jobs").update({
            progress: 20,
            result: { operationName: operation.name, prompt: jobData.prompt },
        }).eq("id", job.id);

        return { status: "processing", progress: 20, result: null, error: null };
    }

    // Phase 2: Poll (reuse text-to-video logic)
    if (operationName) {
        return await processTextToVideo(job, userId, { ...jobData, operationName });
    }

    return stillProcessing(job);
}

// ─────────────────────────────────────────────
// IMAGE GENERATION (Gemini - fast)
// ─────────────────────────────────────────────
async function processImage(job: any, userId: string, jobData: any) {
    if (job.status !== "processing") return currentStatus(job);

    const params = jobData?.params;
    if (!params) return currentStatus(job);

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

        await supabaseAdmin.from("generations").insert({
            id: nanoid(), user_id: userId, type: "image",
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

// ─────────────────────────────────────────────
// CHARACTER IMAGE (fal.ai LoRA)
// ─────────────────────────────────────────────
async function processCharacterImage(job: any, userId: string, jobData: any) {
    if (job.status !== "processing") return currentStatus(job);
    const params = jobData?.params;
    if (!params) return currentStatus(job);

    try {
        const { fal } = await import("@fal-ai/client");
        fal.config({ credentials: process.env.FAL_KEY });

        const sizeMap: Record<string, string> = {
            "1:1": "square", "16:9": "landscape_16_9", "9:16": "portrait_16_9",
            "4:3": "landscape_4_3", "3:4": "portrait_4_3",
        };

        const result = await fal.subscribe("fal-ai/flux-lora", {
            input: {
                prompt: params.fullPrompt,
                loras: [{ path: params.loraUrl, scale: 0.9 }],
                image_size: (sizeMap[params.aspectRatio] || "square") as "square" | "landscape_16_9" | "portrait_16_9" | "landscape_4_3" | "portrait_4_3" | "square_hd",
                num_images: Math.min(params.numImages || 1, 4),
                output_format: "jpeg", guidance_scale: 3.5,
                num_inference_steps: 28, enable_safety_checker: false,
            },
        });

        const images = result.data.images?.map((img: any) => img.url) || [];
        if (images.length === 0) throw new Error("No images generated");

        const uploadedUrls: string[] = [];
        let totalFileSize = 0;
        for (let i = 0; i < images.length; i++) {
            const imgRes = await fetch(images[i]);
            const imgBuf = Buffer.from(await imgRes.arrayBuffer());
            totalFileSize += imgBuf.length;
            const fn = `${userId}/${nanoid()}/character_${i + 1}.jpg`;
            const { error } = await supabaseAdmin.storage.from("content").upload(fn, imgBuf, { contentType: "image/jpeg", upsert: true });
            if (!error) {
                const { data: u } = supabaseAdmin.storage.from("content").getPublicUrl(fn);
                uploadedUrls.push(u.publicUrl);
            } else uploadedUrls.push(images[i]);
        }

        await supabaseAdmin.from("generations").insert({
            id: nanoid(), user_id: userId, type: "image", feature: "character_image",
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

// ─────────────────────────────────────────────
// CHARACTER VIDEO (multi-step: scenes → images → videos)
// ─────────────────────────────────────────────
async function processCharacterVideoStep(job: any, userId: string, jobData: any) {
    if (job.status !== "processing") return currentStatus(job);

    const state = jobData?.state || {};
    const params = jobData?.params;
    if (!params) return currentStatus(job);

    const phase = state.phase || "generate_scenes";

    try {
        switch (phase) {
            // Phase 1: Generate scene descriptions
            case "generate_scenes": {
                const { generateCharacterScenes } = await import("@/lib/services/scene-generator");
                const scenes = await generateCharacterScenes({
                    topic: params.topic,
                    characterName: params.characterName,
                    characterDescription: params.characterDescription,
                    sceneCount: params.sceneCount || 5,
                    style: params.style || "storytelling",
                    language: "he",
                });

                await saveState(job.id, jobData, {
                    phase: "generate_images",
                    scenes,
                    imageUrls: [],
                    currentImageIndex: 0,
                });
                return { status: "processing", progress: 15, result: null, error: null };
            }

            // Phase 2: Generate one image per poll
            case "generate_images": {
                const idx = state.currentImageIndex || 0;
                const scenes = state.scenes || [];

                if (idx >= scenes.length) {
                    // All images done, move to video phase
                    await saveState(job.id, jobData, {
                        ...state,
                        phase: "generate_videos",
                        currentVideoIndex: 0,
                        videoOperations: [],
                        sceneVideoUrls: [],
                    });
                    return { status: "processing", progress: 45, result: null, error: null };
                }

                const { enhancePrompt } = await import("@/lib/services/prompt-enhancer");
                const { generateWithLora } = await import("@/lib/services/modal");

                const scene = scenes[idx];
                const enhanced = await enhancePrompt(scene);
                const triggerWord = params.triggerWord || "ohwx";
                let finalPrompt = enhanced;
                if (!finalPrompt.toLowerCase().includes(triggerWord.toLowerCase())) {
                    finalPrompt = `${triggerWord} person, ${finalPrompt}`;
                }

                let width = 1024, height = 1024;
                if (params.aspectRatio === "9:16") { width = 768; height = 1344; }
                else if (params.aspectRatio === "16:9") { width = 1344; height = 768; }

                const result = await generateWithLora({
                    prompt: finalPrompt,
                    modelUrl: params.loraUrl,
                    triggerWord,
                    width, height,
                    numInferenceSteps: 28,
                    guidanceScale: 3.5,
                    loraScale: params.loraScale || 1.0,
                });

                if (!result.success || !result.image_url) {
                    throw new Error(result.error || "Image generation failed");
                }

                // Download and upload
                const imgRes = await fetch(result.image_url);
                const imgBuf = Buffer.from(await imgRes.arrayBuffer());
                const fn = `${userId}/${job.id}/scene_${idx + 1}.png`;
                await supabaseAdmin.storage.from("content").upload(fn, imgBuf, { contentType: "image/png", upsert: true });
                const { data: urlData } = supabaseAdmin.storage.from("content").getPublicUrl(fn);

                const imageUrls = [...(state.imageUrls || []), urlData.publicUrl];
                const progress = Math.round(15 + ((idx + 1) / scenes.length) * 30);

                await saveState(job.id, jobData, {
                    ...state,
                    imageUrls,
                    currentImageIndex: idx + 1,
                });
                await updateProgress(job.id, progress);

                return { status: "processing", progress, result: null, error: null };
            }

            // Phase 3: Start one video generation per poll
            case "generate_videos": {
                const idx = state.currentVideoIndex || 0;
                const imageUrls = state.imageUrls || [];
                const scenes = state.scenes || [];

                if (idx >= imageUrls.length) {
                    // All videos started, move to polling phase
                    await saveState(job.id, jobData, {
                        ...state,
                        phase: "poll_videos",
                        currentPollIndex: 0,
                    });
                    return { status: "processing", progress: 60, result: null, error: null };
                }

                const scene = scenes[idx];
                const imageUrl = imageUrls[idx];
                const videoPrompt = `Cinematic scene: ${scene}. Smooth natural movement, cinematic lighting, high quality.`;
                const duration = (params.sceneDuration || 4) >= 8 ? 8 : 4;

                // Download image for Veo
                const imgRes = await fetch(imageUrl);
                const imgBuf = Buffer.from(await imgRes.arrayBuffer());
                const imgBase64 = imgBuf.toString("base64");

                const startResponse = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/veo-3.0-fast-generate-001:predictLongRunning?key=${apiKey}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            instances: [{
                                prompt: videoPrompt,
                                image: { bytesBase64Encoded: imgBase64 },
                            }],
                            parameters: {
                                aspectRatio: params.aspectRatio || "9:16",
                                durationSeconds: duration,
                                sampleCount: 1,
                            },
                        }),
                    }
                );

                if (!startResponse.ok) {
                    throw new Error(`Veo start failed for scene ${idx + 1}`);
                }

                const operation = await startResponse.json();
                const videoOperations = [...(state.videoOperations || []), operation.name];

                await saveState(job.id, jobData, {
                    ...state,
                    videoOperations,
                    currentVideoIndex: idx + 1,
                });

                const progress = Math.round(50 + ((idx + 1) / imageUrls.length) * 10);
                await updateProgress(job.id, progress);

                return { status: "processing", progress, result: null, error: null };
            }

            // Phase 4: Poll each video for completion, download one at a time
            case "poll_videos": {
                const videoOperations = state.videoOperations || [];
                const sceneVideoUrls = state.sceneVideoUrls || [];
                const pollIdx = state.currentPollIndex || 0;

                if (pollIdx >= videoOperations.length) {
                    // All videos done! Finalize
                    return await finalizeCharacterVideo(job, userId, jobData, state);
                }

                const opName = videoOperations[pollIdx];
                const pollRes = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/${opName}?key=${apiKey}`
                );

                if (!pollRes.ok) return stillProcessing(job);
                const pollData = await pollRes.json();

                if (!pollData.done) {
                    const progress = Math.round(60 + (pollIdx / videoOperations.length) * 30);
                    return { status: "processing", progress, result: null, error: null };
                }

                if (pollData.error) {
                    throw new Error(`Video scene ${pollIdx + 1} failed: ${pollData.error.message}`);
                }

                const videoUri = extractVideoUri(pollData);
                if (!videoUri) throw new Error(`No video URL for scene ${pollIdx + 1}`);

                // Download and upload
                const dlUrl = videoUri.includes("?") ? `${videoUri}&key=${apiKey}` : `${videoUri}?key=${apiKey}`;
                const vidRes = await fetch(dlUrl);
                if (!vidRes.ok) throw new Error(`Download failed for scene ${pollIdx + 1}`);

                const vidBuf = Buffer.from(await vidRes.arrayBuffer());
                const fn = `${userId}/${job.id}/scene_${pollIdx + 1}_video.mp4`;
                await supabaseAdmin.storage.from("content").upload(fn, vidBuf, { contentType: "video/mp4", upsert: true });
                const { data: vidUrl } = supabaseAdmin.storage.from("content").getPublicUrl(fn);

                const newSceneVideoUrls = [...sceneVideoUrls, vidUrl.publicUrl];

                await saveState(job.id, jobData, {
                    ...state,
                    sceneVideoUrls: newSceneVideoUrls,
                    currentPollIndex: pollIdx + 1,
                });

                const progress = Math.round(60 + ((pollIdx + 1) / videoOperations.length) * 30);
                await updateProgress(job.id, progress);

                return { status: "processing", progress, result: null, error: null };
            }

            default:
                return stillProcessing(job);
        }
    } catch (error: any) {
        console.error(`[CharacterVideo] Phase ${phase} error:`, error);
        await failJob(job.id, userId, CREDIT_COSTS.video_generation, error.message, "החזר - יצירת וידאו דמות נכשלה");
        return { status: "failed", progress: 0, result: null, error: error.message };
    }
}

async function finalizeCharacterVideo(job: any, userId: string, jobData: any, state: any) {
    const imageUrls = state.imageUrls || [];
    const sceneVideoUrls = state.sceneVideoUrls || [];
    const params = jobData.params;

    let totalFileSize = 0;
    for (const url of [...imageUrls, ...sceneVideoUrls]) {
        try {
            const headRes = await fetch(url, { method: "HEAD" });
            const cl = headRes.headers.get("content-length");
            if (cl) totalFileSize += parseInt(cl, 10);
        } catch {
            totalFileSize += url.includes("video") ? 2 * 1024 * 1024 : 500 * 1024;
        }
    }

    const totalDuration = (state.scenes?.length || 1) * (params.sceneDuration || 4);

    await supabaseAdmin.from("generations").insert({
        id: nanoid(), user_id: userId, type: "video", feature: "character_video",
        prompt: params.topic || "", result_urls: [sceneVideoUrls[0], ...sceneVideoUrls, ...imageUrls],
        thumbnail_url: imageUrls[0], duration: totalDuration, status: "completed",
        job_id: job.id, completed_at: new Date().toISOString(),
        character_id: params.characterId, file_size_bytes: totalFileSize, files_deleted: false,
    });

    if (totalFileSize > 0) await updateUserStorage(userId, totalFileSize);

    const result = {
        videoUrl: sceneVideoUrls[0],
        thumbnailUrl: imageUrls[0],
        imageUrls, sceneVideoUrls,
        scenes: state.scenes,
        duration: totalDuration,
    };

    await completeJob(job.id, result);
    return { status: "completed", progress: 100, result, error: null };
}

// ─────────────────────────────────────────────
// VIDEO CLIPS (Vizard - multi-step)
// ─────────────────────────────────────────────
async function processVideoClipsStep(job: any, userId: string, jobData: any) {
    if (job.status !== "processing") return currentStatus(job);

    const state = jobData?.state || {};
    const params = jobData?.params;
    if (!params) return currentStatus(job);

    const phase = state.phase || "create_project";

    try {
        switch (phase) {
            // Phase 1: Create Vizard project
            case "create_project": {
                const { createProjectFromUrl } = await import("@/lib/services/vizard");

                let videoUrl = params.videoUrl;

                // If file was uploaded, upload it first
                if (params.videoBuffer) {
                    const buf = Buffer.from(params.videoBuffer, "base64");
                    const path = `${userId}/${job.id}/original.mp4`;
                    await supabaseAdmin.storage.from("content").upload(path, buf, { contentType: "video/mp4", upsert: true });
                    const { data } = supabaseAdmin.storage.from("content").getPublicUrl(path);
                    videoUrl = data.publicUrl;
                }

                const result = await createProjectFromUrl(videoUrl, {
                    language: params.language,
                    preferLength: params.preferLength,
                    aspectRatio: params.aspectRatio,
                    maxClips: params.maxClips,
                });

                await saveState(job.id, jobData, {
                    phase: "poll_vizard",
                    projectId: result.projectId,
                    videoUrl,
                });
                await updateProgress(job.id, 10);

                return { status: "processing", progress: 10, result: null, error: null };
            }

            // Phase 2: Poll Vizard for completion
            case "poll_vizard": {
                const { queryProject } = await import("@/lib/services/vizard");
                const result = await queryProject(state.projectId);

                if (result === null) {
                    // Still processing
                    const progress = estimateProgress(job, 600, 10, 80);
                    await updateProgress(job.id, progress);
                    return { status: "processing", progress, result: null, error: null };
                }

                if (result.videos.length === 0) {
                    throw new Error("Vizard completed but no clips generated");
                }

                // Clips ready — start downloading
                await saveState(job.id, jobData, {
                    ...state,
                    phase: "download_clips",
                    vizardClips: result.videos,
                    downloadedClips: [],
                    currentClipIndex: 0,
                });
                await updateProgress(job.id, 80);

                return { status: "processing", progress: 80, result: null, error: null };
            }

            // Phase 3: Download one clip per poll
            case "download_clips": {
                const clips = state.vizardClips || [];
                const idx = state.currentClipIndex || 0;
                const downloaded = state.downloadedClips || [];

                if (idx >= clips.length) {
                    // All clips downloaded, finalize
                    return await finalizeVideoClips(job, userId, jobData, state, downloaded);
                }

                const clip = clips[idx];
                const clipUrl = clip.videoUrl || clip.video_url;

                if (!clipUrl) {
                    // Skip this clip
                    await saveState(job.id, jobData, { ...state, currentClipIndex: idx + 1 });
                    return { status: "processing", progress: 80 + Math.round((idx / clips.length) * 15), result: null, error: null };
                }

                const clipRes = await fetch(clipUrl);
                if (!clipRes.ok) {
                    await saveState(job.id, jobData, { ...state, currentClipIndex: idx + 1 });
                    return { status: "processing", progress: 80 + Math.round((idx / clips.length) * 15), result: null, error: null };
                }

                const clipBuf = Buffer.from(await clipRes.arrayBuffer());
                const clipPath = `${userId}/${job.id}/clip_${idx + 1}.mp4`;
                await supabaseAdmin.storage.from("content").upload(clipPath, clipBuf, { contentType: "video/mp4", upsert: true });
                const { data: clipUrlData } = supabaseAdmin.storage.from("content").getPublicUrl(clipPath);

                const newDownloaded = [...downloaded, {
                    url: clipUrlData.publicUrl,
                    thumbnail: clipUrlData.publicUrl,
                    title: clip.title || `קליפ ${idx + 1}`,
                    duration: clip.videoMsDuration ? Math.round(clip.videoMsDuration / 1000) : clip.duration,
                    transcript: clip.transcript,
                    viralScore: clip.viralScore,
                    viralReason: clip.viralReason,
                    editorUrl: clip.clipEditorUrl,
                    fileSize: clipBuf.length,
                }];

                const progress = 80 + Math.round(((idx + 1) / clips.length) * 15);
                await saveState(job.id, jobData, {
                    ...state,
                    downloadedClips: newDownloaded,
                    currentClipIndex: idx + 1,
                });
                await updateProgress(job.id, progress);

                return { status: "processing", progress, result: null, error: null };
            }

            default:
                return stillProcessing(job);
        }
    } catch (error: any) {
        console.error(`[VideoClips] Phase ${phase} error:`, error);
        await failJob(job.id, userId, CREDIT_COSTS.video_clips, error.message, "החזר - חיתוך וידאו נכשל");
        return { status: "failed", progress: 0, result: null, error: error.message };
    }
}

async function finalizeVideoClips(job: any, userId: string, jobData: any, state: any, clips: any[]) {
    if (clips.length === 0) {
        await failJob(job.id, userId, CREDIT_COSTS.video_clips, "No clips saved", "החזר - לא נשמרו קליפים");
        return { status: "failed", progress: 0, result: null, error: "No clips saved" };
    }

    const totalFileSize = clips.reduce((sum: number, c: any) => sum + (c.fileSize || 0), 0);

    await supabaseAdmin.from("generations").insert({
        id: nanoid(), user_id: userId, type: "video", feature: "video_clips",
        source_url: state.videoUrl, result_urls: clips.map((c: any) => c.url),
        thumbnail_url: clips[0]?.thumbnail, status: "completed",
        job_id: job.id, completed_at: new Date().toISOString(),
        file_size_bytes: totalFileSize, files_deleted: false,
    });

    if (totalFileSize > 0) await updateUserStorage(userId, totalFileSize);
    await completeJob(job.id, { clips });

    return { status: "completed", progress: 100, result: { clips }, error: null };
}

// ─────────────────────────────────────────────
// CAROUSEL
// ─────────────────────────────────────────────
async function processCarousel(job: any, userId: string, jobData: any) {
    if (job.status !== "processing") return currentStatus(job);
    const params = jobData?.params;
    if (!params) return currentStatus(job);

    try {
        const { generateCarousel } = await import("@/lib/services/carousel");
        const { generateCarouselContent } = await import("@/lib/services/carousel-content");

        let slides = params.customSlides;
        if (!slides?.length && params.topic) {
            slides = await generateCarouselContent({
                topic: params.topic, slideCount: params.slideCount || 5,
                style: params.style || "educational", language: "he",
            });
        }
        if (!slides?.length) throw new Error("No slides content");

        await updateProgress(job.id, 40);

        const result = await generateCarousel({
            slides, templateId: params.templateId,
            logoUrl: params.brandLogo, logoBase64: params.logoBase64,
            brandColor: params.brandColor, logoPosition: params.logoPosition,
            logoSize: params.logoSize, logoTransparent: params.logoTransparent,
            fontFamily: params.fontFamily, headlineFontSize: params.headlineFontSize,
            bodyFontSize: params.bodyFontSize, fontColor: params.fontColor,
            customBackgroundBase64: params.customBackgroundBase64,
        });

        await updateProgress(job.id, 70);

        const uploadedUrls: string[] = [];
        let totalFileSize = 0;
        for (let i = 0; i < result.images.length; i++) {
            const buf = result.images[i];
            totalFileSize += buf.length;
            const fn = `${userId}/${job.id}/slide_${i + 1}.png`;
            const { error } = await supabaseAdmin.storage.from("content").upload(fn, buf, { contentType: "image/png", upsert: true });
            if (!error) {
                const { data } = supabaseAdmin.storage.from("content").getPublicUrl(fn);
                uploadedUrls.push(data.publicUrl);
            }
        }

        await supabaseAdmin.from("generations").insert({
            id: nanoid(), user_id: userId, type: "carousel", feature: "carousel_generation",
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

// ─────────────────────────────────────────────
// REEL CONVERSION
// ─────────────────────────────────────────────
async function processReel(job: any, userId: string, jobData: any) {
    if (job.status !== "processing") return currentStatus(job);
    const params = jobData?.params;
    if (!params?.url) return currentStatus(job);

    try {
        const { extractReelFrames } = await import("@/lib/services/reel-extractor");
        const sharp = (await import("sharp")).default;

        const frames = await extractReelFrames(params.url, 10);
        await updateProgress(job.id, 50);

        const uploaded: any[] = [];
        let totalFileSize = 0;

        for (let i = 0; i < frames.length; i++) {
            let buffer: Buffer;
            if (frames[i].url.startsWith("data:image")) {
                buffer = Buffer.from(frames[i].url.split(",")[1], "base64");
            } else {
                const res = await fetch(frames[i].url);
                buffer = Buffer.from(await res.arrayBuffer());
            }

            try {
                const meta = await sharp(buffer).metadata();
                if (meta.width && meta.height && (meta.width < 1080 || meta.height < 1080)) {
                    buffer = await sharp(buffer).resize(1080, 1080, { fit: "cover" }).jpeg({ quality: 95 }).toBuffer();
                } else {
                    buffer = await sharp(buffer).jpeg({ quality: 95 }).toBuffer();
                }
            } catch { }

            totalFileSize += buffer.length;
            const fn = `${userId}/${job.id}/frame_${i + 1}.jpg`;
            const { error } = await supabaseAdmin.storage.from("content").upload(fn, buffer, { contentType: "image/jpeg", upsert: true });
            if (!error) {
                const { data } = supabaseAdmin.storage.from("content").getPublicUrl(fn);
                uploaded.push({ url: data.publicUrl, timestamp: frames[i].timestamp });
            }
        }

        await supabaseAdmin.from("generations").insert({
            id: nanoid(), user_id: userId, type: "reel", feature: "convert_reel",
            source_url: params.url, result_urls: uploaded.map((f: any) => f.url),
            thumbnail_url: uploaded[0]?.url, status: "completed", job_id: job.id,
            completed_at: new Date().toISOString(), file_size_bytes: totalFileSize, files_deleted: false,
        });

        if (totalFileSize > 0) await updateUserStorage(userId, totalFileSize);
        await completeJob(job.id, { frames: uploaded });
        return { status: "completed", progress: 100, result: { frames: uploaded }, error: null };
    } catch (error: any) {
        await failJob(job.id, userId, CREDIT_COSTS.video_generation, error.message, "החזר - המרת רילז נכשלה");
        return { status: "failed", progress: 0, result: null, error: error.message };
    }
}


// ─────────────────────────────────────────────
// CARTOONIZE
// ─────────────────────────────────────────────
async function processCartoonize(job: any, userId: string, jobData: any) {
    if (job.status !== "processing") return currentStatus(job);
    const params = jobData?.params;
    if (!params?.imageBase64) return currentStatus(job);

    try {
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const sharp = (await import("sharp")).default;

        const genAI = new GoogleGenerativeAI(apiKey);

        await updateProgress(job.id, 15);

        // Step 1: Analyze image with Gemini Vision
        const visionModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const VISION_PROMPT = `Analyze this photograph in EXTREME detail. Extract the following information with precise accuracy:
1. Subject description: Describe the person's appearance in detail - face shape, hair color/style/texture, eye color, skin tone, clothing colors and style, body type, pose, age range
2. Facial features: Identify EVERY distinctive facial feature - exact eye shape and color, nose shape and size, mouth shape, lip thickness, eyebrow shape and thickness, cheekbones, jawline, face shape (round/oval/square/heart), any unique features like dimples, freckles, facial hair
3. Expression: Describe the person's exact expression - smile type, eye expression, overall mood
4. Setting/environment: Describe the background and surroundings
5. Hobby/profession clues: Identify any props, clothing, or context that suggests their interests or profession
6. Key props: List any notable objects or accessories visible
CRITICAL: Be extremely specific about facial features, proportions, and unique characteristics.`;

        const visionResult = await visionModel.generateContent([
            { inlineData: { data: params.imageBase64, mimeType: params.mimeType } },
            VISION_PROMPT,
        ]);

        const imageDescription = visionResult.response.text();

        await updateProgress(job.id, 35);

        // Step 2: Extract info and build prompt
        const extractInfo = (desc: string) => {
            const get = (pattern: RegExp, fallback: string) => {
                const match = desc.match(pattern);
                return match?.[1]?.trim() || fallback;
            };
            return {
                subjectDescription: get(/subject description[:\-]?\s*(.+?)(?=\n|$)/i, desc.split('\n')[0] || "the person"),
                facialFeature: get(/facial features[:\-]?\s*(.+?)(?=\n|$)/i, "distinctive eyes and facial structure"),
                expression: get(/expression[:\-]?\s*(.+?)(?=\n|$)/i, "their natural expression"),
                setting: get(/setting[:\-]?\s*(.+?)(?=\n|$)/i, "a clean, modern environment"),
                hobby: get(/hobby[:\-]?\s*(.+?)(?=\n|$)/i, "their interests"),
                prop1: get(/props[:\-]?\s*(.+?)(?=,|\n|$)/i, "their accessories"),
                prop2: "their personal items",
            };
        };

        const info = extractInfo(imageDescription);

        const caricaturePrompt = `A professional digital caricature of ${params.subjectDescription || info.subjectDescription}.
CRITICAL IDENTITY PRESERVATION: The caricature MUST look like the exact same person. Preserve ALL distinctive facial features: ${info.facialFeature}. Maintain the exact same expression: ${info.expression}. Keep the same hair color, style, and texture. Preserve eye color, shape, and spacing.
Art style: Highly expressive, oversized head on a smaller dynamic body. Exaggerate ${info.facialFeature} while maintaining perfect likeness. Place in ${params.settingEnvironment || info.setting} reflecting passion for ${params.hobbyProfession || info.hobby}. Include props like ${info.prop1}. 3D Pixar-inspired aesthetic, vibrant colors, cinematic lighting, clean high-contrast background.
Technical: Square 1080x1080, high quality professional digital art, exaggerated caricature proportions, no text or watermarks.`;

        await updateProgress(job.id, 50);

        // Step 3: Generate caricature image
        const imageModel = genAI.getGenerativeModel({
            model: "gemini-3-pro-image-preview",
            generationConfig: { responseModalities: ["IMAGE"] } as any,
        });

        const imageResult = await imageModel.generateContent([
            { inlineData: { data: params.imageBase64, mimeType: params.mimeType } },
            caricaturePrompt,
        ]);

        const imagePart = imageResult.response.candidates?.[0]?.content?.parts?.find(
            (p: any) => p.inlineData?.mimeType?.startsWith("image/")
        );

        if (!imagePart?.inlineData) {
            throw new Error("לא נוצרה תמונת קריקטורה. נסה תמונה אחרת.");
        }

        await updateProgress(job.id, 80);

        // Step 4: Resize to 1080x1080
        const generatedBuffer = Buffer.from(imagePart.inlineData.data, "base64");
        const resizedBuffer = await sharp(generatedBuffer)
            .resize(1080, 1080, { fit: "cover", position: "center" })
            .png({ quality: 100 })
            .toBuffer();

        // Step 5: Upload
        const fileName = `${userId}/${job.id}/caricature.png`;
        const { error: uploadError } = await supabaseAdmin.storage
            .from("content")
            .upload(fileName, resizedBuffer, { contentType: "image/png", upsert: true });

        if (uploadError) throw new Error("Upload failed: " + uploadError.message);

        const { data: urlData } = supabaseAdmin.storage.from("content").getPublicUrl(fileName);
        const resultUrl = urlData.publicUrl;

        // Save generation record
        await supabaseAdmin.from("generations").insert({
            id: nanoid(), user_id: userId, type: "image", feature: "cartoonize",
            prompt: caricaturePrompt.substring(0, 500), result_urls: [resultUrl],
            thumbnail_url: resultUrl, status: "completed",
            completed_at: new Date().toISOString(), file_size_bytes: resizedBuffer.length,
            files_deleted: false, job_id: job.id,
        });

        await updateUserStorage(userId, resizedBuffer.length);
        await completeJob(job.id, { imageUrl: resultUrl });

        return { status: "completed", progress: 100, result: { imageUrl: resultUrl }, error: null };
    } catch (error: any) {
        console.error("[Cartoonize] Error:", error);
        const creditCost = CREDIT_COSTS.caricature_generation ?? CREDIT_COSTS.image_generation ?? 3;
        await failJob(job.id, userId, creditCost, error.message, "החזר - יצירת קריקטורה נכשלה");
        return { status: "failed", progress: 0, result: null, error: error.message };
    }
}



// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function currentStatus(job: any) {
    return { status: job.status, progress: job.progress, result: job.status === "completed" ? job.result : null, error: job.error };
}

function stillProcessing(job: any) {
    return { status: "processing", progress: job.progress || 10, result: null, error: null };
}

function estimateProgress(job: any, expectedSeconds: number, min = 10, max = 75): number {
    const elapsed = (Date.now() - new Date(job.created_at).getTime()) / 1000;
    return Math.min(max, Math.round(min + (elapsed / expectedSeconds) * (max - min)));
}

async function updateProgress(jobId: string, progress: number) {
    await supabaseAdmin.from("jobs").update({ progress }).eq("id", jobId);
}

async function completeJob(jobId: string, result: any) {
    await supabaseAdmin.from("jobs").update({ status: "completed", progress: 100, result }).eq("id", jobId);
}

async function failJob(jobId: string, userId: string, creditAmount: number, errorMsg: string, refundReason: string) {
    await supabaseAdmin.from("jobs").update({ status: "failed", error: errorMsg, progress: 0 }).eq("id", jobId);
    await addCredits(userId, creditAmount, refundReason, jobId);
}

async function saveState(jobId: string, jobData: any, state: any) {
    await supabaseAdmin.from("jobs").update({
        result: { ...jobData, state },
    }).eq("id", jobId);
}

function extractVideoUri(pollData: any): string | null {
    return (
        pollData.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
        pollData.response?.generatedSamples?.[0]?.video?.uri ||
        pollData.response?.videos?.[0]?.uri ||
        null
    );
}

async function downloadAndSaveVideo(job: any, userId: string, videoUri: string, feature: string, prompt: string) {
    const dlUrl = videoUri.includes("?") ? `${videoUri}&key=${apiKey}` : `${videoUri}?key=${apiKey}`;
    const vidRes = await fetch(dlUrl);
    if (!vidRes.ok) {
        await failJob(job.id, userId, CREDIT_COSTS.video_generation, "Download failed", "החזר - הורדת וידאו נכשלה");
        return { status: "failed", progress: 0, result: null, error: "Download failed" };
    }

    const vidBuf = await vidRes.arrayBuffer();
    if (vidBuf.byteLength < 50000) {
        await failJob(job.id, userId, CREDIT_COSTS.video_generation, "Video too small", "החזר - וידאו לא תקין");
        return { status: "failed", progress: 0, result: null, error: "Invalid video" };
    }

    const fn = `videos/${userId}/${Date.now()}.mp4`;
    await supabaseAdmin.storage.from("generations").upload(fn, vidBuf, { contentType: "video/mp4", upsert: true });
    const { data: { publicUrl } } = supabaseAdmin.storage.from("generations").getPublicUrl(fn);

    await supabaseAdmin.from("generations").insert({
        id: nanoid(), user_id: userId, type: "video", feature,
        prompt, result_urls: [publicUrl], status: "completed",
        completed_at: new Date().toISOString(), file_size_bytes: vidBuf.byteLength,
        files_deleted: false, job_id: job.id,
    });

    await updateUserStorage(userId, vidBuf.byteLength);
    await completeJob(job.id, { videoUrl: publicUrl });
    return { status: "completed", progress: 100, result: { videoUrl: publicUrl }, error: null };
}

function buildEditPrompt(prompt: string, style: string): string {
    const s: Record<string, string> = { realistic: "photorealistic, highly detailed", artistic: "artistic, creative, painterly", cartoon: "cartoon style, animated, colorful", minimal: "minimalist, clean, modern" };
    return `Edit this image: ${prompt}. ${s[style] ? `Style: ${s[style]}.` : ""} Keep the overall composition and produce a high-quality result.`;
}

function buildEnhancedPrompt(prompt: string, style: string, aspectRatio: string): string {
    const s: Record<string, string> = { realistic: "photorealistic, highly detailed, professional photography", artistic: "artistic, creative, painterly, beautiful colors", cartoon: "cartoon style, animated, colorful, fun", minimal: "minimalist, clean, simple, modern design" };
    const r: Record<string, string> = { "1:1": "square composition", "16:9": "wide landscape composition", "9:16": "vertical portrait composition", "4:3": "classic 4:3 composition" };
    return `Create an image: ${prompt}. Style: ${s[style] || ""}. ${r[aspectRatio] || ""}. High quality, professional.`;
}