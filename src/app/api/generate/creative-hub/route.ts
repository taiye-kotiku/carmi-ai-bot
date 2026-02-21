export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { deductCredits } from "@/lib/services/credits";
import { CREDIT_COSTS } from "@/lib/config/credits";
import { extractUrlContent } from "@/lib/services/url-extractor";
import { enhanceTextToVideoPrompt } from "@/lib/services/text-to-video-prompt";

const apiKey = process.env.GOOGLE_AI_API_KEY!;
const VEO_MODELS = ["veo-3.1-fast-generate-preview", "veo-3.0-fast-generate-001"] as const;

type CreativeHubOptions = {
    story?: boolean;
    carousel?: boolean;
    video?: boolean;
    image?: boolean;
};

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const {
            prompt,
            imageBase64,
            imageMimeType,
            videoUrl,
            websiteUrl,
            options = {},
        } = body as {
            prompt: string;
            imageBase64?: string;
            imageMimeType?: string;
            videoUrl?: string;
            websiteUrl?: string;
            options?: CreativeHubOptions;
        };

        const opts: CreativeHubOptions = {
            story: !!options.story,
            carousel: !!options.carousel,
            video: !!options.video,
            image: !!options.image,
        };

        const selected = Object.entries(opts).filter(([, v]) => v).map(([k]) => k);
        if (selected.length === 0) {
            return NextResponse.json(
                { error: "נא לבחור לפחות סוג תוכן אחד" },
                { status: 400 }
            );
        }

        if (!prompt?.trim()) {
            return NextResponse.json(
                { error: "נא להזין תיאור" },
                { status: 400 }
            );
        }

        // Build final prompt (merge URL content if provided)
        let finalPrompt = prompt.trim();
        if (websiteUrl?.trim()) {
            try {
                const extracted = await extractUrlContent(websiteUrl.trim());
                if (extracted.text) {
                    finalPrompt = `${finalPrompt}\n\nתוכן מהאתר:\n${extracted.text.slice(0, 3000)}`;
                }
            } catch (err) {
                console.warn("[CreativeHub] URL extraction failed, using prompt only:", err);
            }
        }

        const hasUserImage = !!imageBase64;

        // Calculate total cost
        const costMap: Record<string, number> = {
            story: CREDIT_COSTS.story_generation,
            carousel: CREDIT_COSTS.carousel_generation,
            video: CREDIT_COSTS.video_generation,
            image: CREDIT_COSTS.image_generation,
        };
        const totalCost = selected.reduce((sum, k) => sum + (costMap[k] ?? 0), 0);

        // Deduct once upfront
        if (totalCost > 0) {
            try {
                await deductCredits(user.id, "creative_hub", totalCost);
            } catch (err) {
                return NextResponse.json(
                    { error: (err as Error).message, code: "INSUFFICIENT_CREDITS" },
                    { status: 402 }
                );
            }
        }

        const jobIds: Record<string, string> = {};

        // Create jobs in parallel
        const jobs: Promise<void>[] = [];

        if (opts.story) {
            jobs.push(
                (async () => {
                    const jobId = nanoid();
                    jobIds.story = jobId;
                    await supabaseAdmin.from("jobs").insert({
                        id: jobId,
                        user_id: user.id,
                        type: "story",
                        status: "processing",
                        progress: 0,
                        result: {
                            prompt: finalPrompt,
                            imageBase64: imageBase64 || null,
                            imageMimeType: imageMimeType || null,
                        },
                    });
                })()
            );
        }

        if (opts.carousel) {
            jobs.push(
                (async () => {
                    const jobId = nanoid();
                    jobIds.carousel = jobId;
                    await supabaseAdmin.from("jobs").insert({
                        id: jobId,
                        user_id: user.id,
                        type: "carousel",
                        status: "processing",
                        progress: 0,
                        result: {
                            params: {
                                topic: finalPrompt,
                                slideCount: 5,
                                style: "educational",
                                templateId: "b1",
                            },
                        },
                    });
                })()
            );
        }

        if (opts.video) {
            jobs.push(
                (async () => {
                    const jobId = nanoid();
                    if (hasUserImage) {
                        // Image-to-video with user's character
                        await supabaseAdmin.from("jobs").insert({
                            id: jobId,
                            user_id: user.id,
                            type: "image_to_video",
                            status: "processing",
                            progress: 0,
                            result: {
                                imageBase64,
                                mimeType: imageMimeType || "image/png",
                                prompt: finalPrompt,
                            },
                        });
                        jobIds.video = jobId;
                    } else {
                        let videoPrompt = finalPrompt;
                        try {
                            videoPrompt = await enhanceTextToVideoPrompt(finalPrompt);
                        } catch {
                            // keep original
                        }

                        let startResponse: Response | null = null;
                        let lastError = "";
                        for (const model of VEO_MODELS) {
                            startResponse = await fetch(
                                `https://generativelanguage.googleapis.com/v1beta/models/${model}:predictLongRunning?key=${apiKey}`,
                                {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                        instances: [{ prompt: videoPrompt }],
                                        parameters: {
                                            aspectRatio: "9:16",
                                            durationSeconds: 8,
                                            sampleCount: 1,
                                        },
                                    }),
                                }
                            );
                            if (startResponse.ok) break;
                            lastError = await startResponse.text();
                            if (lastError.includes("not found")) continue;
                            break;
                        }

                        if (!startResponse?.ok) {
                            const { addCredits } = await import("@/lib/services/credits");
                            await addCredits(user.id, CREDIT_COSTS.video_generation, "החזר - Creative Hub וידאו נכשל", jobId);
                            return;
                        }

                        const operation = await startResponse.json();
                        await supabaseAdmin.from("jobs").insert({
                            id: jobId,
                            user_id: user.id,
                            type: "text_to_video",
                            status: "processing",
                            progress: 10,
                            result: {
                                operationName: operation.name,
                                prompt: finalPrompt,
                                aspectRatio: "9:16",
                                duration: 8,
                            },
                        });
                        jobIds.video = jobId;
                    }
                })()
            );
        }

        if (opts.image) {
            jobs.push(
                (async () => {
                    const jobId = nanoid();
                    jobIds.image = jobId;
                    const imagePrompt = hasUserImage
                        ? `Use the person from the provided image as the main character. Keep their EXACT face, appearance, and likeness. ${finalPrompt}`
                        : finalPrompt;
                    await supabaseAdmin.from("jobs").insert({
                        id: jobId,
                        user_id: user.id,
                        type: hasUserImage ? "edit_image" : "generate_image",
                        status: "processing",
                        progress: 10,
                        result: {
                            params: {
                                prompt: imagePrompt,
                                aspectRatio: "9:16",
                                style: "realistic",
                                imageBase64: imageBase64 || null,
                                imageMimeType: imageMimeType || null,
                            },
                        },
                    });
                })()
            );
        }

        await Promise.all(jobs);

        return NextResponse.json({
            jobIds,
            totalCost,
            prompt: finalPrompt.slice(0, 200),
        });
    } catch (error: any) {
        console.error("[CreativeHub] Error:", error);
        return NextResponse.json(
            { error: error.message || "שגיאה בשרת" },
            { status: 500 }
        );
    }
}
