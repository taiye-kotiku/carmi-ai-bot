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
7. Do NOT use any quotation marks inside the slide text

Return EXACTLY ${slideCount} slides, one per line.
Use this format - each line starts with the slide number and a pipe character:
1|First slide text here
2|Second slide text here
3|Third slide text here

Return ONLY the numbered lines. No JSON, no markdown, no explanation.`;

    try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        console.log("[CarouselContent] Raw response:", responseText.substring(0, 300));

        const slides = parseSlides(responseText, slideCount);

        if (slides.length === 0) {
            throw new Error("No valid slides generated");
        }

        console.log(`[CarouselContent] Generated ${slides.length} slides`);
        return slides;
    } catch (apiError) {
        console.error("[CarouselContent] Error:", apiError);
        if (apiError instanceof Error) {
            if (apiError.message.includes("API_KEY")) {
                throw new Error("GOOGLE_AI_API_KEY חסר או לא תקין");
            }
            throw new Error(`Failed to generate carousel content: ${apiError.message}`);
        }
        throw new Error(`Failed to generate carousel content: ${String(apiError)}`);
    }
}

function parseSlides(text: string, slideCount: number): string[] {
    const cleaned = text
        .replace(/```[a-z]*\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

    // Strategy 1: Parse numbered pipe-separated lines (1|text)
    const pipeLines = cleaned.split("\n")
        .map((line) => line.trim())
        .filter((line) => /^\d+\s*\|/.test(line))
        .map((line) => line.replace(/^\d+\s*\|\s*/, "").trim())
        .filter((line) => line.length > 0);

    if (pipeLines.length >= 2) {
        return pipeLines.slice(0, slideCount);
    }

    // Strategy 2: Parse numbered lines (1. text or 1) text)
    const numberedLines = cleaned.split("\n")
        .map((line) => line.trim())
        .filter((line) => /^\d+[\.\)]\s/.test(line))
        .map((line) => line.replace(/^\d+[\.\)]\s*/, "").trim())
        .filter((line) => line.length > 0);

    if (numberedLines.length >= 2) {
        return numberedLines.slice(0, slideCount);
    }

    // Strategy 3: Try JSON parsing with fixes
    try {
        const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            let jsonStr = jsonMatch[0];
            // Fix common JSON issues: smart quotes, trailing commas
            jsonStr = jsonStr
                .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
                .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
                .replace(/,\s*\]/g, "]");

            const parsed = JSON.parse(jsonStr);
            if (Array.isArray(parsed)) {
                const strings = parsed
                    .map((s: any) => (typeof s === "string" ? s : typeof s === "object" && s?.text ? s.text : String(s)))
                    .filter((s: string) => s.trim().length > 0);
                if (strings.length >= 2) {
                    return strings.slice(0, slideCount);
                }
            }
        }
    } catch {
        // JSON parsing failed, continue to next strategy
    }

    // Strategy 4: Split by non-empty lines (last resort)
    const rawLines = cleaned.split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 3 && !line.startsWith("#") && !line.startsWith("//"));

    if (rawLines.length >= 2) {
        return rawLines.slice(0, slideCount);
    }

    return [];
}
