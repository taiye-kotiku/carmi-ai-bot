export const runtime = "nodejs";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { deductCredits, addCredits } from "@/lib/services/credits";
import { CREDIT_COSTS } from "@/lib/config/credits";

const apiKey = process.env.GOOGLE_AI_API_KEY!;

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

        // Deduct credits upfront (atomic check + deduction)
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

        console.log("Veo request:", { prompt, aspectRatio, duration });

        // Start video generation
        const startResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/veo-3.0-fast-generate-001:predictLongRunning?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    instances: [{ prompt }],
                    parameters: {
                        aspectRatio,
                        durationSeconds: duration,
                        sampleCount: 1,
                    },
                }),
            }
        );

        if (!startResponse.ok) {
            const errorText = await startResponse.text();
            console.error("Veo start error:", errorText);

            // Refund credits — API call failed
            await addCredits(
                user.id,
                CREDIT_COSTS.video_generation,
                "החזר - יצירת וידאו נכשלה"
            );

            return NextResponse.json(
                { error: "יצירת הוידאו נכשלה" },
                { status: 400 }
            );
        }

        const operation = await startResponse.json();
        console.log("Operation:", operation.name);

        // Poll for completion
        let googleVideoUrl: string;
        try {
            googleVideoUrl = await pollForVideo(operation.name);
        } catch (pollError) {
            // Refund credits — polling/generation failed
            await addCredits(
                user.id,
                CREDIT_COSTS.video_generation,
                "החזר - יצירת וידאו נכשלה"
            );
            throw pollError;
        }

        console.log("Google URL:", googleVideoUrl);

        // Download video with API key authentication
        const downloadUrl = googleVideoUrl.includes("?")
            ? `${googleVideoUrl}&key=${apiKey}`
            : `${googleVideoUrl}?key=${apiKey}`;

        const videoResponse = await fetch(downloadUrl);

        if (!videoResponse.ok) {
            console.error("Download failed:", videoResponse.status);

            await addCredits(
                user.id,
                CREDIT_COSTS.video_generation,
                "החזר - הורדת וידאו נכשלה"
            );

            return NextResponse.json(
                { error: "הורדת הוידאו נכשלה" },
                { status: 500 }
            );
        }

        const videoBuffer = await videoResponse.arrayBuffer();
        console.log("Video size:", videoBuffer.byteLength);

        if (videoBuffer.byteLength < 50000) {
            await addCredits(
                user.id,
                CREDIT_COSTS.video_generation,
                "החזר - וידאו לא תקין"
            );

            return NextResponse.json(
                { error: "הוידאו שנוצר לא תקין" },
                { status: 500 }
            );
        }

        // Upload to Supabase Storage
        const fileName = `videos/${user.id}/${Date.now()}.mp4`;

        const { error: uploadError } = await supabaseAdmin.storage
            .from("generations")
            .upload(fileName, videoBuffer, {
                contentType: "video/mp4",
                upsert: true,
            });

        if (uploadError) {
            console.error("Upload error:", uploadError);

            await addCredits(
                user.id,
                CREDIT_COSTS.video_generation,
                "החזר - העלאת וידאו נכשלה"
            );

            return NextResponse.json(
                { error: "העלאת הוידאו נכשלה" },
                { status: 500 }
            );
        }

        const { data: { publicUrl } } = supabaseAdmin.storage
            .from("generations")
            .getPublicUrl(fileName);

        console.log("Public URL:", publicUrl);

        return NextResponse.json({
            success: true,
            videoUrl: publicUrl,
        });
    } catch (error: any) {
        console.error("Video error:", error);

        // Last-resort refund attempt
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

async function pollForVideo(operationName: string): Promise<string> {
    for (let i = 0; i < 120; i++) {
        await new Promise((r) => setTimeout(r, 5000));

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`
        );

        if (!response.ok) continue;

        const data = await response.json();
        console.log(`Poll ${i}: done=${data.done}`);

        if (data.done) {
            if (data.error) {
                throw new Error(data.error.message || "Generation failed");
            }

            const videoUri =
                data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
                data.response?.generatedSamples?.[0]?.video?.uri ||
                data.response?.videos?.[0]?.uri;

            if (videoUri) return videoUri;

            console.error("Response structure:", JSON.stringify(data).slice(0, 1000));
            throw new Error("No video URL in response");
        }
    }

    throw new Error("Timeout - video generation took too long");
}