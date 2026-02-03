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
                        durationSeconds: duration,
                        sampleCount: 1,
                    },
                }),
            }
        );

        if (!startResponse.ok) {
            const errorText = await startResponse.text();
            console.error("Veo start error:", errorText);

            // Check if it's a billing/quota issue
            if (startResponse.status === 402 || startResponse.status === 429) {
                return NextResponse.json(
                    { error: "חריגה ממכסת השימוש. נסה שוב מאוחר יותר." },
                    { status: 429 }
                );
            }

            throw new Error(`Veo error: ${startResponse.status}`);
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
            { error: "יצירת הוידאו נכשלה. נסה שוב." },
            { status: 500 }
        );
    }
}

async function pollForVideo(operationName: string): Promise<string> {
    const maxAttempts = 120; // 10 minutes max (5s * 120)

    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000));

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`
        );

        if (!response.ok) {
            console.error("Poll error:", await response.text());
            continue;
        }

        const data = await response.json();

        if (data.done) {
            if (data.error) {
                throw new Error(data.error.message || "Video generation failed");
            }

            // Extract video URL from response
            const videoUri =
                data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
                data.response?.videos?.[0]?.uri ||
                data.response?.videoUri ||
                data.result?.videos?.[0]?.uri;

            if (!videoUri) {
                console.error("No video URI in response:", JSON.stringify(data));
                throw new Error("No video URL in response");
            }

            return videoUri;
        }

        console.log(`Video generation progress: ${data.metadata?.progress || 'processing'}...`);
    }

    throw new Error("Video generation timed out");
}