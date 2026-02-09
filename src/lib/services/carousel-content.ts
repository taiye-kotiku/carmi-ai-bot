// src/lib/services/carousel-content.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

interface GenerateContentOptions {
    topic: string;
    slideCount: number;
    style: "educational" | "promotional" | "storytelling" | "tips";
    language: "he" | "en";
}

export async function generateCarouselContent(options: GenerateContentOptions): Promise<string[]> {
    const { topic, slideCount, style, language } = options;

    const apiKey = process.env.GOOGLE_AI_API_KEY?.trim();
    if (!apiKey) {
        throw new Error("GOOGLE_AI_API_KEY חסר ב-.env.local. הפעל מחדש את השרת (npm run dev).");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const styleInstructions = {
        educational: "informative, clear explanations, building knowledge step by step",
        promotional: "engaging, highlight benefits, create urgency, call to action at the end",
        storytelling: "narrative flow, emotional connection, relatable examples",
        tips: "practical advice, actionable steps, numbered tips",
    };

    const languageInstructions = language === "he"
        ? "Write in Hebrew. Use natural Hebrew phrasing. Use *word* to mark words that should appear in bold yellow."
        : "Write in English. Use *word* to mark words that should appear in bold yellow.";

    const prompt = `Create content for a ${slideCount}-slide carousel about: "${topic}"

Style: ${styleInstructions[style]}
${languageInstructions}

Rules:
1. First slide should be an attention-grabbing title/hook
2. Each slide should have 1-2 short sentences (max 25 words per slide)
3. Last slide should have a call-to-action or memorable conclusion
4. Keep text concise - it needs to fit on a visual slide
5. Use *asterisks* around 1-2 key words per slide for emphasis (they will display in bold yellow)
6. Make each slide flow naturally to the next

Return ONLY a JSON array of strings, one per slide. No markdown, no explanation.
Example: ["הנה *ההזדמנות* שלך", "Slide 2 text", "Slide 3 text"]`;

    try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        console.log("Gemini response:", responseText.substring(0, 200));

        // Parse JSON from response
        try {
            // Clean up response - remove markdown code blocks if present
            let cleanedResponse = responseText
                .replace(/```json\n?/g, "")
                .replace(/```\n?/g, "")
                .trim();

            // Try to extract JSON array if wrapped in text
            const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                cleanedResponse = jsonMatch[0];
            }

            if (!cleanedResponse.startsWith("[")) {
                throw new Error("Response does not contain a JSON array");
            }

            const slides = JSON.parse(cleanedResponse);

            if (!Array.isArray(slides)) {
                console.error("Response is not an array:", slides);
                throw new Error("Response is not an array");
            }

            if (slides.length === 0) {
                throw new Error("Generated empty slides array");
            }

            const finalSlides = slides.slice(0, slideCount).filter((s: any) => s && typeof s === "string" && s.trim().length > 0);
            
            if (finalSlides.length === 0) {
                throw new Error("No valid slides after filtering");
            }

            console.log(`Generated ${finalSlides.length} slides`);
            return finalSlides;
        } catch (parseError) {
            console.error("Failed to parse carousel content:", parseError);
            console.error("Raw response:", responseText);
            throw new Error(`Failed to parse carousel content: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        }
    } catch (apiError) {
        console.error("Gemini API error:", apiError);
        if (apiError instanceof Error) {
            if (apiError.message.includes("API_KEY")) {
                throw new Error("GOOGLE_AI_API_KEY חסר או לא תקין");
            }
            throw new Error(`Failed to generate carousel content: ${apiError.message}`);
        }
        throw new Error(`Failed to generate carousel content: ${String(apiError)}`);
    }
}