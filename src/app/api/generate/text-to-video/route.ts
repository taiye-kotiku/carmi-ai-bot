export const runtime = "nodejs";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const apiKey = process.env.GOOGLE_AI_API_KEY!;

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { error: "יש להתחבר כדי ליצור וידאו" },
                { status: 401 }
            );
        }

        const { prompt, aspectRatio = "16:9", duration = 5 } = await request.json();

        if (!prompt) {
            return NextResponse.json(
                { error: "נא להזין תיאור לוידאו" },
                { status: 400 }
            );
        }

        // Ensure duration is valid (Veo accepts 4-8 seconds only!)
        const validDuration = Math.min(8, Math.max(4, Number(duration) || 5));

        // Start video generation with Veo 3.0 Fast
        const startResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/veo-3.0-fast-generate-001:predictLongRunning?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    instances: [{ prompt }],
                    parameters: {
                        aspectRatio: aspectRatio,
                        durationSeconds: validDuration, // Must be 4-8
                        sampleCount: 1,
                    },
                }),
            }
        );

        if (!startResponse.ok) {
            const errorData = await startResponse.json().catch(() => ({}));
            console.error("Veo start error:", JSON.stringify(errorData));

            return NextResponse.json(
                { error: errorData.error?.message || "יצירת הוידאו נכשלה" },
                { status: startResponse.status }
            );
        }

        const operation = await startResponse.json();

        // Poll for completion
        const videoUrl = await pollForVideo(operation.name);

        return NextResponse.json({
            success: true,
            videoUrl,
        });
    } catch (error: any) {
        console.error("Video generation error:", error);
        return NextResponse.json(
            { error: error.message || "יצירת הוידאו נכשלה. נסה שוב." },
            { status: 500 }
        );
    }
}

async function pollForVideo(operationName: string): Promise<string> {
    const maxAttempts = 120;

    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000));

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`
        );

        if (!response.ok) continue;

        const data = await response.json();

        if (data.done) {
            if (data.error) {
                throw new Error(data.error.message || "Video generation failed");
            }

            const videoUri =
                data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
                data.response?.videos?.[0]?.uri ||
                data.response?.videoUri;

            if (!videoUri) {
                throw new Error("No video URL in response");
            }

            return videoUri;
        }
    }

    throw new Error("Video generation timed out");
}