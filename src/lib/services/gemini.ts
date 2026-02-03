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

        const systemPrompt = type === "image"
            ? `Translate Hebrew to English if needed. Enhance for image generation with lighting, style, quality. Under 150 words. Return ONLY the prompt.`
            : `Translate Hebrew to English if needed. Enhance for video with camera movement, mood, cinematic details. Under 100 words. Return ONLY the prompt.`;

        const result = await model.generateContent(`${systemPrompt}\n\nPrompt: ${prompt}`);
        return result.response.text().trim() || prompt;
    } catch (error) {
        console.error("Gemini enhancement error:", error);
        return prompt;
    }
}

// Image generation with Nano Banana Pro
export async function generateImage(prompt: string): Promise<string[]> {
    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-3-pro-image-preview", // Nano Banana Pro
            generationConfig: {
                responseModalities: ["Image"],
            } as any,
        });

        const response = await model.generateContent(prompt);
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
        console.error("Nano Banana error:", error);
        throw error;
    }
}

// Video generation with Veo 3.0 Fast
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
                    durationSeconds: options.duration || 5,
                },
            }),
        }
    );

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Veo error: ${error}`);
    }

    const data = await response.json();

    // Veo returns a long-running operation, need to poll for result
    if (data.name) {
        return await pollVideoOperation(data.name);
    }

    return data.predictions?.[0]?.videoUri || data.videoUri;
}

// Poll for video completion
async function pollVideoOperation(operationName: string): Promise<string> {
    const maxAttempts = 60; // 5 minutes max

    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`
        );

        const data = await response.json();

        if (data.done) {
            if (data.error) {
                throw new Error(`Video failed: ${data.error.message}`);
            }
            return data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri
                || data.response?.videoUri;
        }
    }

    throw new Error("Video generation timed out");
}

// Image to Video with Veo 3.0 Fast
export async function imageToVideo(
    imageUrl: string,
    prompt: string,
    options: { aspectRatio?: string; duration?: number } = {}
): Promise<string> {
    let imageBase64 = imageUrl;

    if (imageUrl.startsWith("http")) {
        const imgResponse = await fetch(imageUrl);
        const buffer = await imgResponse.arrayBuffer();
        imageBase64 = Buffer.from(buffer).toString("base64");
    } else {
        imageBase64 = imageUrl.replace(/^data:image\/\w+;base64,/, "");
    }

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/veo-3.0-fast-generate-001:predictLongRunning?key=${apiKey}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                instances: [{
                    prompt,
                    image: { bytesBase64Encoded: imageBase64 },
                }],
                parameters: {
                    aspectRatio: options.aspectRatio || "16:9",
                    durationSeconds: options.duration || 5,
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