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

        const body = await request.json();
        const prompt = body.prompt;
        const aspectRatio = body.aspectRatio || "16:9";

        // Veo ONLY accepts 4 or 8 seconds
        const requestedDuration = Number(body.duration) || 8;
        const duration = requestedDuration <= 5 ? 4 : 8;

        if (!prompt) {
            return NextResponse.json(
                { error: "נא להזין תיאור לוידאו" },
                { status: 400 }
            );
        }

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
            console.error("Veo error:", errorText);
            return NextResponse.json(
                { error: "יצירת הוידאו נכשלה" },
                { status: 400 }
            );
        }

        const operation = await startResponse.json();
        const videoUrl = await pollForVideo(operation.name);

        return NextResponse.json({ success: true, videoUrl });
    } catch (error: any) {
        console.error("Video error:", error);
        return NextResponse.json(
            { error: error.message || "יצירת הוידאו נכשלה" },
            { status: 500 }
        );
    }
}

async function pollForVideo(operationName: string): Promise<string> {
    for (let i = 0; i < 120; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000));

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${process.env.GOOGLE_AI_API_KEY}`
        );

        if (!response.ok) continue;

        const data = await response.json();

        if (data.done) {
            if (data.error) throw new Error(data.error.message);

            const videoUri =
                data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
                data.response?.videos?.[0]?.uri;

            if (videoUri) return videoUri;
            throw new Error("No video URL");
        }
    }
    throw new Error("Timeout");
}