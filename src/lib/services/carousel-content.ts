// src/lib/services/carousel-content.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

interface GenerateContentOptions {
    topic: string;
    slideCount: number;
    style: "educational" | "promotional" | "storytelling" | "tips";
    language: "he" | "en";
}

export async function generateCarouselContent(options: GenerateContentOptions): Promise<string[]> {
    const { topic, slideCount, style, language } = options;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const styleInstructions = {
        educational: "informative, clear explanations, building knowledge step by step",
        promotional: "engaging, highlight benefits, create urgency, call to action at the end",
        storytelling: "narrative flow, emotional connection, relatable examples",
        tips: "practical advice, actionable steps, numbered tips",
    };

    const languageInstructions = language === "he"
        ? "Write in Hebrew. Use natural Hebrew phrasing."
        : "Write in English.";

    const prompt = `Create content for a ${slideCount}-slide carousel about: "${topic}"

Style: ${styleInstructions[style]}
${languageInstructions}

Rules:
1. First slide should be an attention-grabbing title/hook
2. Each slide should have 1-2 short sentences (max 25 words per slide)
3. Last slide should have a call-to-action or memorable conclusion
4. Keep text concise - it needs to fit on a visual slide
5. Make each slide flow naturally to the next

Return ONLY a JSON array of strings, one per slide. No markdown, no explanation.
Example: ["Slide 1 text", "Slide 2 text", "Slide 3 text"]`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Parse JSON from response
    try {
        // Clean up response - remove markdown code blocks if present
        const cleanedResponse = responseText
            .replace(/```json\n?/g, "")
            .replace(/```\n?/g, "")
            .trim();

        const slides = JSON.parse(cleanedResponse);

        if (!Array.isArray(slides)) {
            throw new Error("Response is not an array");
        }

        return slides.slice(0, slideCount);
    } catch (error) {
        console.error("Failed to parse carousel content:", error);
        throw new Error("Failed to generate carousel content");
    }
}