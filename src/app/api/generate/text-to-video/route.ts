export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { deductCredits, addCredits } from "@/lib/services/credits";
import { CREDIT_COSTS } from "@/lib/config/credits";
import { enhanceTextToVideoPrompt } from "@/lib/services/text-to-video-prompt";
import { nanoid } from "nanoid";

const apiKey = process.env.GOOGLE_AI_API_KEY!;
const VEO_MODELS = ["veo-3.1-fast-generate-preview", "veo-3.0-fast-generate-001"] as const;

export async function POST(request: NextRequest) {
    try {
        if (!apiKey) {
            return NextResponse.json(
                { error: "שירות יצירת הוידאו לא מוגדר" },
                { status: 503 }
            );
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { error: "יש להתחבר כדי ליצור וידאו" },
                { status: 401 }
            );
        }

        const body = await request.json();
        const prompt = body.prompt;
        const aspectRatio = body.aspectRatio === "9:16" ? "9:16" : "16:9";
        const duration = body.duration === 4 ? 4 : 8;

        if (!prompt) {
            return NextResponse.json(
                { error: "נא להזין תיאור לוידאו" },
                { status: 400 }
            );
        }

        // Enhance prompt for best Veo 3.1 results (wraps Hebrew/English in detailed cinematic prompt)
        let finalPrompt: string;
        try {
            finalPrompt = await enhanceTextToVideoPrompt(prompt.trim());
        } catch (err) {
            console.error("Text-to-video prompt enhancement failed:", err);
            finalPrompt = prompt.trim();
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

        // Start video generation (try Veo 3.1 first, fallback to 3.0)
        let startResponse: Response | null = null;
        let lastError = "";

        for (const model of VEO_MODELS) {
            startResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:predictLongRunning?key=${apiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        instances: [{ prompt: finalPrompt }],
                        parameters: {
                            aspectRatio,
                            durationSeconds: duration,
                            sampleCount: 1,
                            generateAudio: model.startsWith("veo-3.1") || model.startsWith("veo-3.0"),
                        },
                    }),
                }
            );
            if (startResponse.ok) break;
            lastError = await startResponse.text();
            console.warn(`Veo ${model} failed:`, startResponse.status, lastError);
            if (startResponse.status === 404 || lastError.includes("not found") || lastError.includes("NotFound")) continue;
            break; // Don't retry on auth/rate-limit/etc
        }

        if (!startResponse || !startResponse.ok) {
            const errorText = lastError;
            console.error("Veo start error:", startResponse?.status, errorText);

            let userMessage = "יצירת הוידאו נכשלה";
            try {
                const errJson = JSON.parse(errorText);
                const msg = errJson.error?.message || errJson.message;
                if (msg) userMessage = msg;
            } catch {
                if (errorText.length < 200) userMessage = errorText;
            }

            await addCredits(
                user.id,
                CREDIT_COSTS.video_generation,
                "החזר - יצירת וידאו נכשלה"
            );

            return NextResponse.json(
                { error: userMessage },
                { status: 400 }
            );
        }

        const operation = await startResponse!.json();
        console.log("Veo operation started:", operation.name);

        // Create job with the operation name stored in result
        const jobId = nanoid();
        await supabaseAdmin.from("jobs").insert({
            id: jobId,
            user_id: user.id,
            type: "text_to_video",
            status: "processing",
            progress: 10,
            result: {
                operationName: operation.name,
                prompt: prompt, // original for display
                aspectRatio,
                duration,
            },
        });

        // Return immediately — client will poll /api/jobs/[id]
        return NextResponse.json({ jobId });
    } catch (error: any) {
        console.error("Video start error:", error);

        try {
            const supabase = await createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await addCredits(
                    user.id,
                    CREDIT_COSTS.video_generation,
                    "החזר - יצירת וידאו נכשלה"
                );
            }
        } catch (refundError) {
            console.error("Refund failed:", refundError);
        }

        return NextResponse.json(
            { error: error.message || "יצירת הוידאו נכשלה" },
            { status: 500 }
        );
    }
}