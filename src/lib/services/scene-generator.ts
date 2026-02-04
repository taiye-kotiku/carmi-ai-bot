// src/lib/services/scene-generator.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

interface GenerateScenesOptions {
    topic: string;
    characterName: string;
    characterDescription?: string;
    sceneCount: number;
    style: "storytelling" | "educational" | "promotional" | "lifestyle";
    language: "he" | "en";
}

export async function generateCharacterScenes(options: GenerateScenesOptions): Promise<string[]> {
    const { topic, characterName, characterDescription, sceneCount, style, language } = options;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const styleInstructions = {
        storytelling: "Create a narrative arc with beginning, middle, and end. Each scene should flow naturally to the next.",
        educational: "Present information progressively, building understanding step by step.",
        promotional: "Showcase benefits and features, ending with a strong call to action.",
        lifestyle: "Show day-in-the-life scenes, relatable moments, aspirational settings.",
    };

    const languageInstructions = language === "he"
        ? "Write scene descriptions in English (for AI image generation) but consider Hebrew cultural context."
        : "Write in English.";

    const characterContext = characterDescription
        ? `The character is: ${characterDescription}.`
        : "";

    const prompt = `Create ${sceneCount} scene descriptions for a video slideshow featuring a character named "${characterName}".
${characterContext}

Topic/Story: "${topic}"

Style: ${styleInstructions[style]}
${languageInstructions}

Rules:
1. Each scene description should be detailed enough for AI image generation
2. Include setting, lighting, mood, action, and camera angle
3. Keep the character's appearance consistent (don't describe their physical features, the AI will handle that)
4. Focus on what the character is DOING and WHERE they are
5. Each scene should be visually distinct but flow as part of a cohesive story
6. Include specific details about environment, props, and atmosphere

Return ONLY a JSON array of scene description strings.
Example: ["Scene 1 description...", "Scene 2 description..."]`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    try {
        const cleanedResponse = responseText
            .replace(/```json\n?/g, "")
            .replace(/```\n?/g, "")
            .trim();

        const scenes = JSON.parse(cleanedResponse);

        if (!Array.isArray(scenes)) {
            throw new Error("Response is not an array");
        }

        return scenes.slice(0, sceneCount);
    } catch (error) {
        console.error("Failed to parse scenes:", error);
        throw new Error("Failed to generate scene descriptions");
    }
}