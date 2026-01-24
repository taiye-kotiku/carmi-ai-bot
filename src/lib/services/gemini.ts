import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

// Text to Image using Gemini's Imagen model
export async function generateImage(prompt: string): Promise<string[]> {
    try {
        // Using Gemini 2.0 Flash with image generation
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-exp",
            generationConfig: {
                responseModalities: ["image", "text"],
            } as any,
        });

        const response = await model.generateContent(prompt);
        const result = response.response;

        const images: string[] = [];

        if (result.candidates && result.candidates[0]?.content?.parts) {
            for (const part of result.candidates[0].content.parts) {
                if (part.inlineData) {
                    // Return base64 image data
                    const base64Image = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    images.push(base64Image);
                }
            }
        }

        return images;
    } catch (error) {
        console.error("Gemini image generation error:", error);
        throw error;
    }
}

// Text to Video using Veo model
export async function generateVideo(prompt: string): Promise<string> {
    try {
        // Note: Veo 2 is available through Vertex AI
        // For now, we'll use a placeholder that you can connect to Vertex AI
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictVideo?key=${process.env.GOOGLE_AI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    instances: [{ prompt }],
                    parameters: {
                        sampleCount: 1,
                        durationSeconds: 5,
                        aspectRatio: "9:16", // Vertical for social media
                    },
                }),
            }
        );

        if (!response.ok) {
            throw new Error(`Video generation failed: ${response.statusText}`);
        }

        const data = await response.json();
        return data.predictions[0].videoUri;
    } catch (error) {
        console.error("Gemini video generation error:", error);
        throw error;
    }
}

// Image to Video
export async function imageToVideo(
    imageBase64: string,
    prompt: string
): Promise<string> {
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictVideo?key=${process.env.GOOGLE_AI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    instances: [{
                        prompt,
                        image: {
                            bytesBase64Encoded: imageBase64.replace(/^data:image\/\w+;base64,/, ""),
                        },
                    }],
                    parameters: {
                        sampleCount: 1,
                        durationSeconds: 5,
                        aspectRatio: "9:16",
                    },
                }),
            }
        );

        if (!response.ok) {
            throw new Error(`Image to video failed: ${response.statusText}`);
        }

        const data = await response.json();
        return data.predictions[0].videoUri;
    } catch (error) {
        console.error("Gemini image-to-video error:", error);
        throw error;
    }
}

// Enhance prompt for better results (Hebrew to English + enhancement)
export async function enhancePrompt(
    hebrewPrompt: string,
    type: "image" | "video"
): Promise<string> {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const systemPrompt = type === "image"
        ? `You are a prompt engineer. Translate the Hebrew prompt to English and enhance it for image generation. 
           Add details about lighting, style, quality. Keep it concise but descriptive.
           Only return the enhanced English prompt, nothing else.`
        : `You are a prompt engineer. Translate the Hebrew prompt to English and enhance it for video generation.
           Add details about camera movement, scene, mood. Keep it cinematic.
           Only return the enhanced English prompt, nothing else.`;

    const result = await model.generateContent([
        systemPrompt,
        `Hebrew prompt: ${hebrewPrompt}`,
    ]);

    return result.response.text();
}