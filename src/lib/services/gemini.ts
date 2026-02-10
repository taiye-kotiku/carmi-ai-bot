// src/lib/services/gemini.ts

import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GOOGLE_AI_API_KEY!;
const genAI = new GoogleGenerativeAI(apiKey);

// Enhance prompt with Gemini 2.5 Flash
export async function enhancePrompt(
    prompt: string,
    type: "image" | "video" = "image"
): Promise<string> {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const systemPrompt =
            type === "image"
                ? `Translate Hebrew to English if needed. Enhance for image generation with lighting, style, quality. Ensure the prompt specifies: realistic, photorealistic, high quality, professional photography, impressive, detailed, sharp focus, 1080x1080 square format. Under 150 words. Return ONLY the enhanced prompt.`
                : `Translate Hebrew to English if needed. Enhance for video with camera movement, mood, cinematic details. Under 100 words. Return ONLY the prompt.`;

        const result = await model.generateContent(
            `${systemPrompt}\n\nPrompt: ${prompt}`
        );
        return result.response.text().trim() || prompt;
    } catch (error) {
        console.error("Gemini enhancement error:", error);
        return prompt;
    }
}

// Image generation with Gemini image model
export async function generateImage(prompt: string): Promise<string[]> {
    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-3-pro-image-preview",
            generationConfig: {
                responseModalities: ["Image"],
            } as any,
        });

        const systemPrompt = `Create a realistic, photorealistic, high-quality, professional image. Square format 1080x1080px. Sharp focus, detailed, impressive. No text or watermarks. Professional lighting.

${prompt}`;

        const response = await model.generateContent(systemPrompt);
        const result = response.response;

        const images: string[] = [];
        const parts = result.candidates?.[0]?.content?.parts ?? [];

        for (const part of parts) {
            if ((part as any).inlineData) {
                const inline = (part as any).inlineData;
                images.push(`data:${inline.mimeType};base64,${inline.data}`);
            }
        }

        return images;
    } catch (error) {
        console.error("Image generation error:", error);
        throw error;
    }
}

// Video generation with Veo 3.0 Fast (text-to-video)
export async function generateVideo(
    prompt: string,
    options: { aspectRatio?: string; duration?: number } = {}
): Promise<string> {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/veo-3.0-fast-generate-001:predictLongRunning?key=${apiKey}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                instances: [{ prompt }],
                parameters: {
                    aspectRatio: options.aspectRatio || "16:9",
                    durationSeconds: options.duration === 8 ? 8 : 4,
                },
            }),
        }
    );

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Veo error: ${error}`);
    }

    const data = await response.json();

    if (data.name) {
        return await pollVideoOperation(data.name);
    }

    return data.predictions?.[0]?.videoUri || data.videoUri;
}

// Image-to-Video with Veo 3.0 Fast
export async function imageToVideo(
    imageUrl: string,
    prompt: string,
    options: { aspectRatio?: string; duration?: number } = {}
): Promise<string> {
    let imageBase64 = imageUrl;
    let mimeType = "image/png";

    if (imageUrl.startsWith("http")) {
        const imgResponse = await fetch(imageUrl);
        if (!imgResponse.ok) {
            throw new Error(
                `Failed to fetch image: ${imgResponse.statusText}`
            );
        }
        mimeType = imgResponse.headers.get("content-type") || "image/png";
        const buffer = await imgResponse.arrayBuffer();
        imageBase64 = Buffer.from(buffer).toString("base64");
    } else if (imageUrl.startsWith("data:")) {
        const match = imageUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
        if (match) {
            mimeType = match[1];
            imageBase64 = match[2];
        } else {
            imageBase64 = imageUrl.replace(/^data:image\/[^;]+;base64,/, "");
        }
    }

    console.log(
        `[Veo I2V] Sending image (${mimeType}, ${(imageBase64.length / 1024).toFixed(0)}KB base64) with prompt: "${prompt.substring(0, 80)}..."`
    );

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/veo-3.0-fast-generate-001:predictLongRunning?key=${apiKey}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                instances: [
                    {
                        prompt,
                        image: {
                            bytesBase64Encoded: imageBase64,
                            mimeType: mimeType,
                        },
                    },
                ],
                parameters: {
                    aspectRatio: options.aspectRatio || "16:9",
                    durationSeconds: options.duration === 8 ? 8 : 4,
                },
            }),
        }
    );

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Veo I2V error: ${error}`);
    }

    const data = await response.json();

    if (data.name) {
        return await pollVideoOperation(data.name);
    }

    return data.predictions?.[0]?.videoUri;
}

// Poll a Veo long-running operation until done
async function pollVideoOperation(operationName: string): Promise<string> {
    const maxAttempts = 60; // 5 minutes max

    for (let i = 0; i < maxAttempts; i++) {
        await new Promise((resolve) => setTimeout(resolve, 5000));

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`
        );

        if (!response.ok) {
            console.error(
                `[Veo] Poll error: ${response.status} ${response.statusText}`
            );
            continue;
        }

        const data = await response.json();

        if (!data.done) {
            const meta = data.metadata || {};
            console.log(
                `[Veo] Polling... done=${data.done}, progress=${meta.percentComplete || "unknown"}%`
            );
            continue;
        }

        // Operation is done
        if (data.error) {
            throw new Error(
                `Video generation failed: ${data.error.message || JSON.stringify(data.error)}`
            );
        }

        // Log full response for debugging
        console.log(
            "[Veo] Full done response:",
            JSON.stringify(data, null, 2).substring(0, 3000)
        );

        const responseBody = data.response || {};

        // Try multiple known response structures
        const generateResponse =
            responseBody.generateVideoResponse || responseBody;

        const samples =
            generateResponse?.generatedSamples ||
            generateResponse?.videos ||
            responseBody?.generatedSamples ||
            responseBody?.videos ||
            [];

        if (samples.length > 0) {
            const sample = samples[0];

            // Path 1: base64 encoded video in response
            const encoded =
                sample.video?.encodedVideo ||
                sample.encodedVideo ||
                sample.video ||
                null;

            if (encoded && encoded.bytesBase64Encoded) {
                const base64Data = encoded.bytesBase64Encoded;
                const videoMime = encoded.mimeType || "video/mp4";
                console.log(
                    `[Veo] Got base64 video (${(base64Data.length / 1024 / 1024).toFixed(1)}MB)`
                );
                return `data:${videoMime};base64,${base64Data}`;
            }

            // Path 2: video URI
            const videoUri =
                sample.video?.uri ||
                sample.uri ||
                sample.videoUri ||
                sample.video?.videoUri ||
                null;

            if (videoUri) {
                console.log(`[Veo] Got video URI: ${videoUri.substring(0, 120)}...`);

                // Try with API key
                const separator = videoUri.includes("?") ? "&" : "?";
                const authedUrl = `${videoUri}${separator}key=${apiKey}`;

                try {
                    const testFetch = await fetch(authedUrl, {
                        method: "HEAD",
                    });
                    if (testFetch.ok) {
                        console.log("[Veo] Authed URL works");
                        return authedUrl;
                    }
                } catch { }

                // Try raw URI
                try {
                    const rawTest = await fetch(videoUri, { method: "HEAD" });
                    if (rawTest.ok) {
                        console.log("[Veo] Raw URL works");
                        return videoUri;
                    }
                } catch { }

                // If neither HEAD works, still try authed URL (some servers block HEAD)
                console.warn(
                    "[Veo] HEAD requests failed, returning authed URL anyway"
                );
                return authedUrl;
            }

            // Path 3: sample itself might be base64
            if (typeof sample === "string") {
                console.log("[Veo] Sample is a string, treating as URI");
                return sample;
            }

            console.error(
                "[Veo] Sample structure unknown:",
                JSON.stringify(sample).substring(0, 500)
            );
        }

        // Last resort: check for any predictionsUri or similar
        const predictions = responseBody.predictions || [];
        if (predictions.length > 0) {
            const pred = predictions[0];
            const uri = pred.videoUri || pred.uri || pred;
            if (typeof uri === "string") {
                console.log("[Veo] Found prediction URI:", uri.substring(0, 120));
                return uri;
            }
        }

        console.error(
            "[Veo] Could not extract video. Full response:",
            JSON.stringify(data).substring(0, 2000)
        );
        throw new Error("Could not extract video from Veo response");
    }

    throw new Error("Video generation timed out after 5 minutes");
}