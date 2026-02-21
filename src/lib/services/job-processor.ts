// src/lib/services/job-processor.ts

import { supabaseAdmin } from "@/lib/supabase/admin";
import { addCredits } from "@/lib/services/credits";
import { CREDIT_COSTS } from "@/lib/config/credits";
import { updateUserStorage } from "@/lib/services/storage";
import { nanoid } from "nanoid";

const apiKey = process.env.GOOGLE_AI_API_KEY!;

/**
 * Use Gemini to create a short Hebrew narration script for video prompts.
 * This gives Veo 3.1 explicit Hebrew dialogue to produce better Hebrew audio.
 */
async function generateHebrewNarration(prompt: string): Promise<string | null> {
    if (!apiKey || !prompt?.trim()) return null;
    try {
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            systemInstruction: `You are a Hebrew scriptwriter for short social media videos (8-15 seconds).
Given a topic/description, write a short, natural Hebrew narration script that a person would speak in a video.
Rules:
- Write 2-4 short sentences in natural spoken Hebrew
- Keep it concise (max 30 words total)
- Make it engaging and suitable for Instagram content
- Return ONLY the Hebrew text, nothing else`,
        });
        const result = await model.generateContent(
            `Write a short Hebrew narration for a video about: ${prompt.slice(0, 500)}`
        );
        const text = result.response.text()?.trim();
        if (text && text.length > 5 && text.length < 200) return text;
        return null;
    } catch (err) {
        console.warn("[HebrewNarration] Failed:", err);
        return null;
    }
}

/**
 * After video generation, create Hebrew VTT subtitles using Gemini transcription.
 * Returns a WebVTT string or null if transcription fails.
 */
async function generateHebrewVttSubtitles(videoUrl: string): Promise<string | null> {
    try {
        const { transcribeVideoToHebrew } = await import("@/lib/services/video-transcription");
        const entries = await transcribeVideoToHebrew(videoUrl);
        if (!entries || entries.length === 0) return null;

        const lines = ["WEBVTT", ""];
        for (const e of entries) {
            lines.push(formatVttTime(e.start) + " --> " + formatVttTime(e.end));
            lines.push(e.text);
            lines.push("");
        }
        return lines.join("\n");
    } catch (err) {
        console.warn("[HebrewVTT] Subtitle generation failed:", err);
        return null;
    }
}

function formatVttTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}

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
            case "story":
                return await processStory(job, userId, jobData);
            case "convert_reel":
                return await processReel(job, userId, jobData);
            case "video_clips":
                return await processVideoClipsStep(job, userId, jobData);
            case "cartoonize":
                return await processCartoonize(job, userId, jobData);
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

    let finalVideoUri = videoUri;
    if (jobData?.extendTo15) {
        try {
            const { extendVeoVideo } = await import("@/lib/services/veo-extend");
            const extended = await extendVeoVideo(videoUri, jobData.prompt ? `Continue: ${jobData.prompt}` : undefined);
            finalVideoUri = extended.videoUri;
        } catch (err) {
            console.warn("[TextToVideo] Extend failed, using 8s video:", err);
        }
    }

    return await downloadAndSaveVideo(job, userId, finalVideoUri, "text_to_video", jobData.prompt || "");
}

// ─────────────────────────────────────────────
// IMAGE TO VIDEO (start Veo then poll)
// ─────────────────────────────────────────────
async function enhanceImageToVideoPrompt(
    imageBase64: string,
    mimeType: string,
    userPrompt: string
): Promise<string> {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);

    const systemInstruction = `Objective: Act as a professional Cinematographer and AI Prompt Engineer. Your task is to take a short user description and an uploaded image to create a highly detailed, technical prompt for the Veo 3.1 video generation model.

Instructions:

Analyze the Image: Identify the subject's key features (facial structure, hair, clothing) and the setting to ensure visual consistency. The person in the image MUST appear as the main character in the video with their exact likeness preserved.

Expand the Motion: Take the user's short action (e.g., "drinking coffee") and describe it with physics-based realism (e.g., "steam swirling in slow motion," "subtle facial muscle movements").

Apply Cinematic Standards: Always include specific camera movements (Dolly, Pan, Orbit) and professional lighting (Golden Hour, Rim Lighting, Bokeh).

Incorporate Audio & Dialogue: Veo 3.1 generates native audio with speech. If the user's prompt is in Hebrew or contains a Hebrew narration script, you MUST include the exact Hebrew dialogue in the prompt. Write it as: 'The person speaks in Hebrew: "[exact Hebrew text]"'. This is critical for generating proper Hebrew speech.

Hebrew Content: If the user's prompt is in Hebrew, ALL spoken dialogue, narration, voiceover, text overlays, signs, and written content in the video MUST be in Hebrew. Never translate Hebrew - keep it in Hebrew script within the prompt.

Output Structure:
Your final output should be a single, flowing paragraph following this formula:
[Cinematography] + [Subject Details] + [Dynamic Action] + [Environmental Context] + [Style/Ambiance] + [Audio Keywords]

Return ONLY the enhanced prompt, no preamble.`;

    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction,
    });

    const userDesc = userPrompt?.trim() || "Animate this image with subtle movement, cinematic quality";
    const result = await model.generateContent([
        { inlineData: { data: imageBase64, mimeType } },
        { text: `User's short description: ${userDesc}` },
    ]);

    const text = result.response.text()?.trim();
    return text || userDesc;
}

async function processImageToVideo(job: any, userId: string, jobData: any) {
    const operationName = jobData?.operationName;

    // Phase 1: Start Veo if not started
    if (!operationName && jobData?.imageBase64) {
        const mimeType = jobData.mimeType || "image/png";
        const userPrompt = jobData.prompt || "";

        let finalPrompt: string;
        try {
            // Generate Hebrew narration script and include it in the prompt
            const hebrewScript = await generateHebrewNarration(userPrompt);
            const promptWithHebrew = hebrewScript
                ? `${userPrompt}. The person speaks the following Hebrew narration naturally: "${hebrewScript}"`
                : userPrompt;
            finalPrompt = await enhanceImageToVideoPrompt(
                jobData.imageBase64,
                mimeType,
                promptWithHebrew
            );
        } catch (err) {
            console.error("[ImageToVideo] Prompt enhancement failed:", err);
            finalPrompt = userPrompt || "Animate this image with subtle movement, cinematic quality. All speech must be in Hebrew.";
        }

        // Try veo-3.1 first (better Hebrew + native image-to-video), fallback to veo-3.0
        const models = ["veo-3.1-fast-generate-preview", "veo-3.0-fast-generate-001"];
        let startResponse: Response | null = null;
        let responseBody = "";

        for (const model of models) {
            startResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:predictLongRunning?key=${apiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        instances: [{
                            prompt: finalPrompt,
                            image: {
                                bytesBase64Encoded: jobData.imageBase64,
                                mimeType: mimeType,
                            },
                        }],
                        parameters: {
                            aspectRatio: "9:16",
                            durationSeconds: 8,
                            sampleCount: 1,
                        },
                    }),
                }
            );
            responseBody = await startResponse.text();
            if (startResponse.ok) break;
            console.warn(`[ImageToVideo] Veo model ${model} failed:`, responseBody.slice(0, 300));
            if (!responseBody.includes("not found")) break;
        }

        if (!startResponse?.ok) {
            const errMsg = (() => {
                try {
                    const j = JSON.parse(responseBody);
                    return j.error?.message || j.message || responseBody.slice(0, 200);
                } catch {
                    return responseBody.slice(0, 200);
                }
            })();
            await failJob(job.id, userId, CREDIT_COSTS.video_generation, errMsg, "החזר - יצירת וידאו מתמונה נכשלה");
            return { status: "failed", progress: 0, result: null, error: errMsg };
        }

        const operation = JSON.parse(responseBody);
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

    if (jobData.generationStarted) {
        return { status: "processing", progress: job.progress || 30, result: null, error: null };
    }
    const { error: lockError } = await supabaseAdmin.from("jobs").update({
        result: { ...jobData, generationStarted: true },
    }).eq("id", job.id).eq("status", "processing");
    if (lockError) return { status: "processing", progress: job.progress, result: null, error: null };

    try {
        const parts: any[] = [];
        if (params.imageBase64 && params.imageBase642 && params.imageMimeType && params.imageMimeType2 && params.style === "combine_images") {
            // Combine 2 images: person (image 1) + character (image 2)
            parts.push({ text: "Image 1 (person):" });
            parts.push({ inlineData: { mimeType: params.imageMimeType, data: params.imageBase64 } });
            parts.push({ text: "Image 2 (character):" });
            parts.push({ inlineData: { mimeType: params.imageMimeType2, data: params.imageBase642 } });
            parts.push({ text: buildCombineImagesPrompt(params.prompt) });
        } else if (params.imageBase64 && params.imageMimeType) {
            parts.push({ inlineData: { mimeType: params.imageMimeType, data: params.imageBase64 } });
            parts.push({ text: buildEditPrompt(params.prompt, params.style) });
        } else {
            parts.push({ text: buildEnhancedPrompt(params.prompt, params.style, params.aspectRatio) });
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts }],
                    generationConfig: {
                        responseModalities: ["Text", "Image"],
                    },
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
        const imageUrl = urlData.publicUrl;
        await completeJob(job.id, { url: imageUrl, imageUrl });
        return { status: "completed", progress: 100, result: { url: imageUrl, imageUrl }, error: null };
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
// STORY (multiple 9:16 images + 1 Veo video)
// ─────────────────────────────────────────────
async function processStory(job: any, userId: string, jobData: any) {
    if (job.status !== "processing") return currentStatus(job);

    const state = jobData?.state || {};
    const prompt = jobData?.prompt;
    const imageBase64 = jobData?.imageBase64;
    const imageMimeType = jobData?.imageMimeType || "image/png";

    if (!prompt) return currentStatus(job);

    const phase = state.phase || "generate_images";
    const imageCount = 4; // 4 story images

    try {
        if (phase === "generate_images") {
            const imageUrls = state.imageUrls || [];
            const idx = imageUrls.length;

            if (idx >= imageCount) {
                // All images done, start video
                await saveState(job.id, jobData, {
                    ...state,
                    phase: "generate_video",
                    imageUrls,
                });
                await updateProgress(job.id, 50);
                return { status: "processing", progress: 50, result: null, error: null };
            }

            const parts: any[] = [];
            const basePrompt = buildEnhancedPrompt(prompt, "realistic", "9:16");
            if (imageBase64) {
                parts.push({ inlineData: { mimeType: imageMimeType, data: imageBase64 } });
                parts.push({ text: `Create a 9:16 vertical story frame based on this image. Keep the EXACT same person/character from the provided image - maintain their face, appearance, clothing and likeness precisely. Theme: ${prompt}. Frame ${idx + 1} of ${imageCount}. Professional, cohesive style. IMPORTANT: Any text, titles, captions, or words visible in the image MUST be written in Hebrew.` });
            } else {
                parts.push({ text: `${basePrompt} Story frame ${idx + 1} of ${imageCount}. Vertical 9:16 composition. IMPORTANT: Any text, titles, captions, or words visible in the image MUST be written in Hebrew.` });
            }

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts }],
                        generationConfig: { responseModalities: ["Text", "Image"] },
                    }),
                }
            );

            if (!response.ok) throw new Error("Gemini image API failed");
            const data = await response.json();
            const imagePart = data.candidates?.[0]?.content?.parts?.find(
                (p: any) => p.inlineData?.mimeType?.startsWith("image/")
            );
            if (!imagePart) throw new Error("No image generated");

            const buffer = Buffer.from(imagePart.inlineData.data, "base64");
            const fileName = `${userId}/${job.id}/story_${idx + 1}.png`;
            await supabaseAdmin.storage.from("content").upload(fileName, buffer, { contentType: "image/png", upsert: true });
            const { data: urlData } = supabaseAdmin.storage.from("content").getPublicUrl(fileName);

            const newUrls = [...imageUrls, urlData.publicUrl];
            await updateUserStorage(userId, buffer.length);
            const progress = Math.round(((idx + 1) / imageCount) * 45);
            await saveState(job.id, jobData, { ...state, imageUrls: newUrls });
            await updateProgress(job.id, progress);

            return { status: "processing", progress, result: null, error: null };
        }

        if (phase === "generate_video") {
            const imageUrls = state.imageUrls || [];
            const operationName = state.videoOperationName;

            if (!operationName) {
                let videoPrompt = prompt;
                try {
                    const hebrewScript = await generateHebrewNarration(prompt);
                    if (hebrewScript) {
                        videoPrompt = `${prompt}. The person in the video speaks the following Hebrew narration naturally: "${hebrewScript}"`;
                    }
                    videoPrompt = await (await import("@/lib/services/text-to-video-prompt")).enhanceTextToVideoPrompt(videoPrompt);
                } catch {
                    // keep original
                }

                // Prepare reference image (user's uploaded photo or first generated story image)
                let refImageBase64: string | null = null;
                if (imageBase64) {
                    refImageBase64 = imageBase64;
                } else if (imageUrls.length > 0) {
                    try {
                        const imgRes = await fetch(imageUrls[0]);
                        const imgBuf = Buffer.from(await imgRes.arrayBuffer());
                        refImageBase64 = imgBuf.toString("base64");
                    } catch {
                        console.warn("[Story] Failed to download story image for video reference");
                    }
                }

                const storyVeoModels = ["veo-3.1-fast-generate-preview", "veo-3.0-fast-generate-001"];
                let startResponse: Response | null = null;
                let lastErr = "";

                for (const model of storyVeoModels) {
                    const instance: any = { prompt: videoPrompt };
                    if (refImageBase64) {
                        instance.image = {
                            bytesBase64Encoded: refImageBase64,
                            mimeType: imageMimeType || "image/png",
                        };
                    }

                    const body: any = {
                        instances: [instance],
                        parameters: {
                            aspectRatio: "9:16",
                            durationSeconds: 8,
                            sampleCount: 1,
                        },
                    };

                    startResponse = await fetch(
                        `https://generativelanguage.googleapis.com/v1beta/models/${model}:predictLongRunning?key=${apiKey}`,
                        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
                    );
                    if (startResponse.ok) break;
                    lastErr = await startResponse.text();
                    console.warn(`[Story] Veo model ${model} failed:`, lastErr);
                    if (!lastErr.includes("not found")) break;
                }

                if (!startResponse?.ok) {
                    await failJob(job.id, userId, CREDIT_COSTS.story_generation, lastErr || "Veo start failed", "החזר - סטורי וידאו נכשל");
                    return { status: "failed", progress: 0, result: null, error: lastErr || "Veo start failed" };
                }

                const operation = await startResponse.json();
                await saveState(job.id, jobData, {
                    ...state,
                    videoOperationName: operation.name,
                    imageUrls,
                });
                await updateProgress(job.id, 55);
                return { status: "processing", progress: 55, result: null, error: null };
            }

            // Poll Veo
            const pollRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`
            );
            if (!pollRes.ok) return stillProcessing(job);

            const pollData = await pollRes.json();
            if (!pollData.done) {
                const progress = estimateProgress(job, 120, 55, 95);
                await updateProgress(job.id, progress);
                return { status: "processing", progress, result: null, error: null };
            }

            if (pollData.error) {
                await failJob(job.id, userId, CREDIT_COSTS.story_generation, pollData.error.message, "החזר - סטורי וידאו נכשל");
                return { status: "failed", progress: 0, result: null, error: pollData.error.message };
            }

            const videoUri = extractVideoUri(pollData);
            if (!videoUri) {
                await failJob(job.id, userId, CREDIT_COSTS.story_generation, "No video URL", "החזר - סטורי וידאו");
                return { status: "failed", progress: 0, result: null, error: "No video URL" };
            }

            const vidRes = await fetch(videoUri.includes("?") ? `${videoUri}&key=${apiKey}` : `${videoUri}?key=${apiKey}`);
            if (!vidRes.ok) {
                await failJob(job.id, userId, CREDIT_COSTS.story_generation, "Download failed", "החזר - סטורי וידאו");
                return { status: "failed", progress: 0, result: null, error: "Download failed" };
            }

            const vidBuf = await vidRes.arrayBuffer();
            const fn = `videos/${userId}/${Date.now()}_story.mp4`;
            await supabaseAdmin.storage.from("generations").upload(fn, vidBuf, { contentType: "video/mp4", upsert: true });
            const { data: { publicUrl } } = supabaseAdmin.storage.from("generations").getPublicUrl(fn);

            // Generate Hebrew subtitles for the story video
            let vttUrl: string | null = null;
            try {
                const vttContent = await generateHebrewVttSubtitles(publicUrl);
                if (vttContent) {
                    const vttFn = `videos/${userId}/${Date.now()}_story_he.vtt`;
                    await supabaseAdmin.storage.from("generations").upload(vttFn, Buffer.from(vttContent, "utf-8"), {
                        contentType: "text/vtt", upsert: true,
                    });
                    const { data: vttData } = supabaseAdmin.storage.from("generations").getPublicUrl(vttFn);
                    vttUrl = vttData.publicUrl;
                }
            } catch (err) {
                console.warn("[Story] VTT generation failed:", err);
            }

            await supabaseAdmin.from("generations").insert({
                id: nanoid(), user_id: userId, type: "video", feature: "story_generation",
                prompt, result_urls: [...(state.imageUrls || []), publicUrl],
                thumbnail_url: state.imageUrls?.[0], status: "completed",
                completed_at: new Date().toISOString(), file_size_bytes: vidBuf.byteLength,
                files_deleted: false, job_id: job.id,
            });

            await updateUserStorage(userId, vidBuf.byteLength);
            const storyResult: any = { imageUrls: state.imageUrls, videoUrl: publicUrl };
            if (vttUrl) storyResult.vttUrl = vttUrl;
            await completeJob(job.id, storyResult);
            return { status: "completed", progress: 100, result: storyResult, error: null };
        }

        return stillProcessing(job);
    } catch (error: any) {
        await failJob(job.id, userId, CREDIT_COSTS.story_generation, error.message, "החזר - יצירת סטורי נכשלה");
        return { status: "failed", progress: 0, result: null, error: error.message };
    }
}

// ─────────────────────────────────────────────
// CAROUSEL
// ─────────────────────────────────────────────
async function processCarousel(job: any, userId: string, jobData: any) {
    if (job.status !== "processing") return currentStatus(job);
    const params = jobData?.params;
    if (!params) return currentStatus(job);

    if (jobData.generationStarted) {
        return { status: "processing", progress: job.progress || 20, result: null, error: null };
    }
    const { error: lockError } = await supabaseAdmin.from("jobs").update({
        result: { ...jobData, generationStarted: true },
    }).eq("id", job.id).eq("status", "processing");
    if (lockError) return { status: "processing", progress: job.progress, result: null, error: null };

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
// CARTOONIZE (Gemini Vision → Working Image Model)
// ─────────────────────────────────────────────
async function processCartoonize(job: any, userId: string, jobData: any) {
    if (job.status !== "processing") return currentStatus(job);

    if (jobData.generationStarted) {
        return { status: "processing", progress: job.progress, result: null, error: null };
    }

    const { error: lockError } = await supabaseAdmin.from("jobs").update({
        result: { ...jobData, generationStarted: true }
    }).eq("id", job.id).select();

    if (lockError) return { status: "processing", progress: job.progress, result: null, error: null };

    const params = jobData?.params;
    if (!params?.imageBase64) return currentStatus(job);

    try {
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const sharp = (await import("sharp")).default;
        const genAI = new GoogleGenerativeAI(apiKey);

        await updateProgress(job.id, 20);

        // STEP 1: VISION (Analyze with Flash 2.0 - it can see but not draw)
        // IMPORTANT: Do NOT send responseModalities: ["IMAGE"] here.
        const visionModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const visionResult = await visionModel.generateContent([
            { inlineData: { data: params.imageBase64, mimeType: params.mimeType } },
            `Carefully analyze the provided image and describe the person in precise visual detail: hair (color, length, texture, style, hairline, facial hair), eyes (color, shape, size, spacing, eyelids, brows, lashes), skin (tone, undertone, texture, blemishes, marks), facial structure (face shape, forehead, cheekbones, jawline, chin, nose shape, lips, symmetry), expression (emotion, eye focus, mouth position), clothing (type, fit, fabric, color, patterns, accessories, logos), posture and body language, visible background elements, lighting (direction, intensity, shadows), estimated age range, and overall impression. Keep the description objective, specific, and concise`,
        ]);

        const description = visionResult.response.text();
        console.log("[Cartoonize] Description:", description);

        await updateProgress(job.id, 50);

        // STEP 2: GENERATION (Use the model that works for Image Generation)
        const env = params.settingEnvironment?.trim() || "Modern Office";
        const profession = params.hobbyProfession?.trim() || "general professional";
        const extraDesc = params.subjectDescription?.trim() || "";

        const caricaturePrompt = `Create a professional avatar/caricature based on this person description: ${description}
${extraDesc ? `Additional subject details: ${extraDesc}.` : ""}

Character Fidelity: Replicate the subject's exact facial structure, hair color/texture, and unique expressions. The cartoon version must be instantly recognizable as the person in the photo.

Professional Integration: Dress the character in professional attire and include 1-2 subtle props related to their specific ${profession}.

Environment: Render a vibrant ${env} with soft cinematic lighting and a slight depth-of-field blur to keep the focus on the figure.

Art Style: Clean 3D rendering, expressive features, and a friendly, confident persona. Avoid "uncanny" realism; aim for a polished, professional avatar.`;

        // Use the exact same endpoint/model as your working Image Generation
        // Note: We use REST fetch to be 100% sure of the endpoint
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: caricaturePrompt }] }],
                    generationConfig: {
                        responseModalities: ["Text", "Image"],
                    },
                }),
            }
        );

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Image Gen API Error: ${err}`);
        }

        const data = await response.json();
        const imagePart = data.candidates?.[0]?.content?.parts?.find(
            (p: any) => p.inlineData?.mimeType?.startsWith("image/")
        );

        if (!imagePart) throw new Error("No image generated");

        const generatedBuffer = Buffer.from(imagePart.inlineData.data, "base64");

        await updateProgress(job.id, 80);

        // STEP 3: Upload
        const resizedBuffer = await sharp(generatedBuffer)
            .resize(1080, 1080, { fit: "cover", position: "center" })
            .png()
            .toBuffer();

        const fileName = `${userId}/${job.id}/caricature.png`;

        await supabaseAdmin.storage
            .from("content")
            .upload(fileName, resizedBuffer, { contentType: "image/png", upsert: true });

        const { data: urlData } = supabaseAdmin.storage.from("content").getPublicUrl(fileName);
        const resultUrl = urlData.publicUrl;

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
        await failJob(job.id, userId, CREDIT_COSTS.caricature_generation || 3, error.message, "החזר - יצירת קריקטורה נכשלה");
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

function findVideoInObject(obj: any, depth = 0): string | null {
    if (!obj || depth > 8) return null;
    if (typeof obj !== "object") return null;
    if (Array.isArray(obj)) {
        for (const item of obj) {
            const r = findVideoInObject(item, depth + 1);
            if (r) return r;
        }
        return null;
    }
    const uri = obj.uri || obj.videoUri;
    if (uri && typeof uri === "string" && (uri.startsWith("http") || uri.startsWith("gs:") || uri.startsWith("https://generativelanguage"))) return uri;
    if (obj.bytesBase64Encoded && typeof obj.bytesBase64Encoded === "string") {
        const mime = obj.mimeType || "video/mp4";
        return `data:${mime};base64,${obj.bytesBase64Encoded}`;
    }
    const fileRef = obj.name;
    if (fileRef && typeof fileRef === "string" && fileRef.includes("files/")) {
        return `https://generativelanguage.googleapis.com/v1beta/${fileRef}?alt=media&key=${apiKey}`;
    }
    for (const v of Object.values(obj)) {
        const r = findVideoInObject(v, depth + 1);
        if (r) return r;
    }
    return null;
}

function extractVideoUri(pollData: any): string | null {
    const resp = pollData.response || pollData.result || {};
    const genResp = resp.generateVideoResponse || resp;

    // Path 1: generatedVideos (Gemini API / Veo 3.1)
    const generatedVideos = resp.generatedVideos || genResp.generatedVideos || [];
    if (generatedVideos.length > 0) {
        const gv = generatedVideos[0];
        const vid = gv.video || gv;
        const uri = vid?.uri || vid?.videoUri || gv.uri || gv.videoUri || null;
        if (uri) return uri;
        // File reference: { name: "files/xxx" } - fetch via Files API
        const fileRef = vid?.name || vid?.file?.name || gv.name;
        if (fileRef && typeof fileRef === "string") {
            const fileId = fileRef.startsWith("files/") ? fileRef : `files/${fileRef}`;
            return `https://generativelanguage.googleapis.com/v1beta/${fileId}?alt=media&key=${apiKey}`;
        }
        const enc = vid?.encodedVideo || vid?.bytesBase64Encoded ? vid : (vid?.video || {});
        if (enc?.bytesBase64Encoded) {
            const mime = enc.mimeType || "video/mp4";
            return `data:${mime};base64,${enc.bytesBase64Encoded}`;
        }
    }

    // Path 2: generateVideoResponse.generatedSamples (Gemini API)
    const samples =
        genResp.generatedSamples ||
        genResp.videos ||
        resp.generatedSamples ||
        resp.videos ||
        [];

    if (samples.length > 0) {
        const s = samples[0];
        const uri =
            s.video?.uri ||
            s.uri ||
            s.videoUri ||
            s.video?.videoUri ||
            null;
        if (uri) return uri;

        // Base64 encoded video
        const enc = s.video?.encodedVideo || s.encodedVideo || s.video;
        if (enc?.bytesBase64Encoded) {
            const mime = enc.mimeType || "video/mp4";
            return `data:${mime};base64,${enc.bytesBase64Encoded}`;
        }
    }

    // Path 3: predictions (Vertex AI / predictLongRunning)
    const preds = resp.predictions || [];
    if (preds.length > 0) {
        const p = preds[0];
        const uri = p.videoUri || p.uri || p.video?.uri || (typeof p === "string" ? p : null);
        if (uri) return uri;
        const enc = p.video?.encodedVideo || p.bytesBase64Encoded ? p : p.video;
        if (enc?.bytesBase64Encoded) {
            const mime = enc.mimeType || "video/mp4";
            return `data:${mime};base64,${enc.bytesBase64Encoded}`;
        }
    }

    // Path 4: top-level videos
    const videos = resp.videos || [];
    if (videos.length > 0) {
        const v = videos[0];
        const uri = v.uri || v.videoUri || v.video?.uri || (typeof v === "string" ? v : null);
        if (uri) return uri;
    }

    // Path 5: result.generateVideoResponse (nested)
    const nested = resp.result?.generateVideoResponse || resp.result;
    if (nested?.generatedSamples?.length > 0) {
        const s = nested.generatedSamples[0];
        const uri = s.video?.uri || s.uri || s.videoUri || null;
        if (uri) return uri;
    }

    // Path 6: Recursive search for video URI or base64 in response
    const found = findVideoInObject(resp);
    if (found) return found;

    // Path 7: Direct top-level search on pollData itself (some APIs wrap differently)
    const foundTop = findVideoInObject(pollData);
    if (foundTop) return foundTop;

    console.warn(
        "[extractVideoUri] No video found. Top-level keys:",
        JSON.stringify(Object.keys(pollData)),
        "| response keys:",
        JSON.stringify(Object.keys(resp)),
        "| Full (truncated):",
        JSON.stringify(pollData).substring(0, 2000)
    );
    return null;
}

async function downloadAndSaveVideo(job: any, userId: string, videoUri: string, feature: string, prompt: string) {
    const isDataUrl = videoUri.startsWith("data:");
    const hasKey = videoUri.includes("key=");
    const dlUrl = isDataUrl ? videoUri : (hasKey ? videoUri : (videoUri.includes("?") ? `${videoUri}&key=${apiKey}` : `${videoUri}?key=${apiKey}`));
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

    // Generate Hebrew VTT subtitles as a fallback for Hebrew audio
    let vttUrl: string | null = null;
    try {
        const vttContent = await generateHebrewVttSubtitles(publicUrl);
        if (vttContent) {
            const vttFn = `videos/${userId}/${Date.now()}_he.vtt`;
            await supabaseAdmin.storage.from("generations").upload(vttFn, Buffer.from(vttContent, "utf-8"), {
                contentType: "text/vtt", upsert: true,
            });
            const { data: vttData } = supabaseAdmin.storage.from("generations").getPublicUrl(vttFn);
            vttUrl = vttData.publicUrl;
        }
    } catch (err) {
        console.warn("[downloadAndSaveVideo] VTT generation failed:", err);
    }

    await supabaseAdmin.from("generations").insert({
        id: nanoid(), user_id: userId, type: "video", feature,
        prompt, result_urls: [publicUrl], status: "completed",
        completed_at: new Date().toISOString(), file_size_bytes: vidBuf.byteLength,
        files_deleted: false, job_id: job.id,
    });

    await updateUserStorage(userId, vidBuf.byteLength);
    const result: any = { videoUrl: publicUrl };
    if (vttUrl) result.vttUrl = vttUrl;
    await completeJob(job.id, result);
    return { status: "completed", progress: 100, result, error: null };
}

function buildCombineImagesPrompt(prompt: string): string {
    return `Combine the person from Image 1 with the character from Image 2 into a single, highly detailed, photorealistic image. Both individuals must appear naturally in the same scene. Preserve accurate facial likeness for both the person and the character. Scene/context: "${prompt}". Use professional lighting, cinematic composition, consistent environment. Both figures should be naturally integrated—same setting, consistent lighting, believable interaction or placement. 8K quality, sharp focus, lifelike skin texture and materials. IMPORTANT: Any text, titles, captions, or words visible in the image MUST be written in Hebrew.`;
}

function buildEditPrompt(prompt: string, style: string): string {
    const hebrewRule = " IMPORTANT: Any text, titles, captions, or words visible in the image MUST be written in Hebrew. Keep the EXACT same person/character from the provided image - maintain their face, appearance, clothing and likeness precisely.";
    if (style === "celebrity") {
        return `Combine the person shown in this uploaded image with the celebrity or scenario described: "${prompt}". Create a highly detailed, photorealistic image featuring BOTH characters naturally in the same scene. Preserve accurate facial likeness for both the person in the uploaded image and the celebrity. Use professional lighting, cinematic composition, and photorealistic quality. Both individuals should appear naturally integrated—same setting, consistent lighting, believable interaction or placement. 8K quality, sharp focus, lifelike skin texture and materials.${hebrewRule}`;
    }
    const s: Record<string, string> = {
        realistic: "Edit this image with photorealistic, highly detailed quality. Use professional photography techniques: sharp focus, natural lighting, authentic skin texture, lifelike materials and reflections. The result should be indistinguishable from a high-end professional photograph. 8K quality, cinematic depth of field. Keep the overall composition and enhance realism.",
        artistic: "Edit this image with an artistic, painterly style. Emphasize creative interpretation: bold brushstrokes, rich color palette, expressive lighting, artistic composition. Blend realism with creative flair. Think fine art, gallery-worthy aesthetic. Evocative and visually striking. Preserve the subject while applying the artistic treatment.",
        cartoon: "Edit this image in a cartoon or animated style. Use clean lines, vibrant colors, expressive character design. Style reminiscent of high-quality animation or illustration. Fun, dynamic, and visually engaging. Suitable for comics or animated content. Maintain recognizability while applying the cartoon aesthetic.",
        minimal: "Edit this image with a minimalist, clean approach. Use simple shapes, limited color palette, ample negative space. Modern, uncluttered composition. Less is more—focus on essential elements. Sophisticated, designer aesthetic. Simplify while preserving the core subject.",
    };
    return `${s[style] || s.realistic}${hebrewRule} User instruction: ${prompt}`;
}

function buildEnhancedPrompt(prompt: string, style: string, aspectRatio: string): string {
    const r: Record<string, string> = {
        "1:1": "square composition, balanced framing",
        "16:9": "wide landscape composition, cinematic widescreen",
        "9:16": "vertical portrait composition, mobile/story format",
        "4:3": "classic 4:3 composition, traditional framing",
    };
    const aspect = r[aspectRatio] || r["1:1"];

    const s: Record<string, string> = {
        realistic: "Create a photorealistic, highly detailed image. Use professional photography techniques: sharp focus, natural lighting, authentic skin texture, lifelike materials and reflections. The result should be indistinguishable from a high-end professional photograph. 8K quality, cinematic depth of field.",
        artistic: "Create an artistic, painterly image. Emphasize creative interpretation: bold brushstrokes, rich color palette, expressive lighting, artistic composition. Blend realism with creative flair. Think fine art, gallery-worthy aesthetic. Evocative and visually striking.",
        cartoon: "Create a cartoon or animated style image. Use clean lines, vibrant colors, expressive character design. Style reminiscent of high-quality animation or illustration. Fun, dynamic, and visually engaging. Suitable for comics or animated content.",
        minimal: "Create a minimalist, clean image. Use simple shapes, limited color palette, ample negative space. Modern, uncluttered composition. Less is more—focus on essential elements. Sophisticated, designer aesthetic.",
        celebrity: "Create a highly detailed, photorealistic image featuring the celebrity and scenario described. Maintain accurate likeness of the celebrity. Professional lighting, cinematic composition. 8K quality, sharp focus, lifelike skin texture.",
    };
    const styleText = s[style] || s.realistic;
    return `${styleText} Composition: ${aspect}. IMPORTANT: Any text, titles, captions, or words visible in the image MUST be written in Hebrew. Subject and scene: ${prompt}`;
}