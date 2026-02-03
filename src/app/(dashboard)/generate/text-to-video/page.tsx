export const runtime = "nodejs";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

        // Veo only supports 16:9 and 9:16
        const aspectRatio = body.aspectRatio === "9:16" ? "9:16" : "16:9";

        // Veo only accepts 4 or 8 seconds
        const duration = body.duration === 4 ? 4 : 8;

        if (!prompt) {
            return NextResponse.json(
                { error: "נא להזין תיאור לוידאו" },
                { status: 400 }
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
            return NextResponse.json(
                { error: "יצירת הוידאו נכשלה" },
                { status: 400 }
            );
        }

        const operation = await startResponse.json();
        console.log("Operation started:", operation.name);

        // Poll for completion
        const googleVideoUrl = await pollForVideo(operation.name);
        console.log("Google video URL:", googleVideoUrl);

        // Download the video with API key authentication
        const videoResponse = await fetch(`${googleVideoUrl}&key=${apiKey}`);

        if (!videoResponse.ok) {
            // Try alternate URL format
            const altUrl = googleVideoUrl.includes('?')
                ? `${googleVideoUrl}&key=${apiKey}`
                : `${googleVideoUrl}?key=${apiKey}`;

            const altResponse = await fetch(altUrl);
            if (!altResponse.ok) {
                throw new Error("Failed to download video from Google");
            }
        }

        const videoBuffer = await videoResponse.arrayBuffer();
        const videoSize = videoBuffer.byteLength;

        console.log("Downloaded video size:", videoSize);

        if (videoSize < 10000) {
            // Video too small, probably an error
            throw new Error("Video file is invalid or too small");
        }

        // Upload to Supabase Storage
        const fileName = `videos/${user.id}/${Date.now()}.mp4`;

        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from("generations")
            .upload(fileName, videoBuffer, {
                contentType: "video/mp4",
                upsert: true,
            });

        if (uploadError) {
            console.error("Upload error:", uploadError);
            throw new Error("Failed to upload video");
        }

        // Get public URL
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
        return NextResponse.json(
            { error: error.message || "יצירת הוידאו נכשלה" },
            { status: 500 }
        );
    }
}

async function pollForVideo(operationName: string): Promise<string> {
    const maxAttempts = 120;

    for (let i = 0; i < maxAttempts; i++) {
        await new Promise((resolve) => setTimeout(resolve, 5000));

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${process.env.GOOGLE_AI_API_KEY}`
        );

        if (!response.ok) {
            console.log("Poll response not ok:", response.status);
            continue;
        }

        const data = await response.json();
        console.log("Poll response:", JSON.stringify(data).slice(0, 500));

        if (data.done) {
            if (data.error) {
                throw new Error(data.error.message || "Video generation failed");
            }

            // Try multiple paths to find the video URL
            const videoUri =
                data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
                data.response?.generatedSamples?.[0]?.video?.uri ||
                data.response?.videos?.[0]?.uri ||
                data.result?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;

            if (videoUri) {
                return videoUri;
            }

            console.error("Full response:", JSON.stringify(data));
            throw new Error("No video URL in response");
        }
    }

    throw new Error("Video generation timed out");
}