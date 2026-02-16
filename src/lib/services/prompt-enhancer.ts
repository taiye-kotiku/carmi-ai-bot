// src/lib/services/prompt-enhancer.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

/**
 * Parse structured character description.
 * Format: "gender:male | hair_style:short hair | hair_color:black hair | notes:..."
 */
function parseCharacterDescription(description: string | null | undefined): {
    gender?: string;
    hairStyle?: string;
    hairColor?: string;
    notes?: string;
} {
    if (!description) return {};

    const result: Record<string, string> = {};

    for (const part of description.split("|")) {
        const trimmed = part.trim();
        const colonIdx = trimmed.indexOf(":");
        if (colonIdx > 0) {
            const key = trimmed.substring(0, colonIdx).trim();
            const value = trimmed.substring(colonIdx + 1).trim();
            if (key === "gender") result.gender = value;
            else if (key === "hair_style") result.hairStyle = value;
            else if (key === "hair_color") result.hairColor = value;
            else if (key === "notes") result.notes = value;
        }
    }

    return result;
}

/**
 * Build an appearance anchor string from character description.
 */
function buildAppearanceAnchor(description: string | null | undefined): string {
    const parsed = parseCharacterDescription(description);
    const parts: string[] = [];

    if (parsed.gender === "male") parts.push("a man");
    else if (parsed.gender === "female") parts.push("a woman");

    if (parsed.hairStyle) parts.push(`with ${parsed.hairStyle}`);
    if (parsed.hairColor) parts.push(`${parsed.hairColor}`);

    if (parsed.notes) {
        // Translate common Hebrew appearance terms
        const notesLower = parsed.notes;
        if (/זקן/.test(notesLower)) parts.push("with a beard");
        if (/משקפיים/.test(notesLower)) parts.push("wearing glasses");
        if (/קעקוע/.test(notesLower)) parts.push("with tattoos");
    }

    return parts.join(", ");
}

/**
 * Translate + enhance a user prompt for FLUX LoRA image generation.
 * Handles Hebrew input, adds photographic quality keywords,
 * and anchors the character's physical appearance.
 */
export async function enhancePrompt(
    text: string,
    characterDescription?: string | null
): Promise<string> {
    if (!process.env.GOOGLE_AI_API_KEY) {
        console.warn("GOOGLE_AI_API_KEY not set, skipping enhancement");
        return text;
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const appearance = buildAppearanceAnchor(characterDescription);
        const appearanceInstruction = appearance
            ? `\n\nIMPORTANT — The subject is: ${appearance}. You MUST include these exact physical traits in the output prompt. Do NOT change hair length, hair color, or gender. If the subject has short hair, do NOT describe long hair. If the subject is male, do NOT describe female features.`
            : "";

        const systemInstruction = `You are an expert AI image prompt engineer specializing in photorealistic portrait and lifestyle photography prompts for the FLUX.1 image model.

Your task: take the user's input (which may be in Hebrew, English, or mixed) and produce a single, high-quality English prompt.

Rules:
1. ALWAYS output in English, even if the input is Hebrew. Translate accurately.
2. Preserve the user's core intent — do not change the subject, setting, or mood they described.
3. Add professional photography details: lighting type, camera angle, depth of field, texture details.
4. For portraits/people: include skin detail, expression, pose direction, clothing detail if relevant.
5. Always include at the end: "highly detailed, sharp focus, professional photography, 8k quality"
6. DO NOT include any trigger word like "ohwx", "TOK", or "sks". The system adds that separately.
7. DO NOT include negative prompts or instructions like "no watermark".
8. Output ONLY the final prompt as a single paragraph. No explanations, no bullet points, no quotes.
9. Keep it under 120 words.${appearanceInstruction}

Examples:
- Input: "בפיג'מה בבית" (subject: a man, with short hair, black hair) → "a man with short black hair wearing cozy cotton pajamas, relaxed at home on a comfortable sofa, warm ambient lighting from a table lamp, soft bokeh background of a living room, genuine warm smile, natural skin texture, highly detailed, sharp focus, professional photography, 8k quality"
- Input: "בחוף הים בשקיעה" (subject: a woman, with long hair, blonde hair) → "a woman with long blonde hair standing on a sandy beach at golden hour sunset, warm orange and pink sky reflecting on the ocean, gentle sea breeze, relaxed casual summer outfit, natural sun-kissed skin, waves softly breaking in the background, cinematic composition, highly detailed, sharp focus, professional photography, 8k quality"`;

        const result = await model.generateContent(
            `${systemInstruction}\n\nUser input: "${text}"`
        );
        const enhanced = result.response.text().trim();

        if (!enhanced || enhanced.length < 10) {
            console.warn("[Prompt] Enhancement returned empty/short, using original");
            return text;
        }

        console.log(`[Prompt] "${text}" → "${enhanced}"`);
        return enhanced;

    } catch (error) {
        console.error("[Prompt] Enhancement failed:", error);
        return text;
    }
}

/**
 * Lightweight translation-only (no enhancement).
 */
export async function translateToEnglish(text: string): Promise<string> {
    const hasHebrew = /[\u0590-\u05FF]/.test(text);
    if (!hasHebrew) return text;

    if (!process.env.GOOGLE_AI_API_KEY) return text;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent(
            `Translate the following Hebrew text to English. Output ONLY the translation, nothing else.\n\n"${text}"`
        );
        return result.response.text().trim() || text;
    } catch {
        return text;
    }
}