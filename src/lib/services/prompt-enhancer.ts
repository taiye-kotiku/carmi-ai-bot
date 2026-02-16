// src/lib/services/prompt-enhancer.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

/**
 * Translate + enhance a user prompt for FLUX image generation.
 * Handles Hebrew input, adds photographic quality keywords.
 */
export async function enhancePrompt(text: string): Promise<string> {
    if (!process.env.GOOGLE_AI_API_KEY) {
        console.warn("GOOGLE_AI_API_KEY not set, skipping enhancement");
        return text;
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const systemInstruction = `You are an expert AI image prompt engineer specializing in photorealistic portrait and lifestyle photography prompts for the FLUX.1 image model.

Your task: take the user's input (which may be in Hebrew, English, or mixed) and produce a single, high-quality English prompt.

Rules:
1. ALWAYS output in English, even if the input is Hebrew. Translate accurately.
2. Preserve the user's core intent — do not change the subject, setting, or mood they described.
3. Add professional photography details that improve output quality: lighting type (e.g. soft natural light, golden hour, studio lighting), camera angle, depth of field, texture details, color palette hints.
4. For portraits/people: include skin detail, expression, pose direction, clothing detail if relevant.
5. Always include at the end: "highly detailed, sharp focus, professional photography, 8k quality"
6. DO NOT include any trigger word like "ohwx", "TOK", or "sks". The system adds that separately.
7. DO NOT include negative prompts or instructions like "no watermark".
8. Output ONLY the final prompt as a single paragraph. No explanations, no bullet points, no quotes.
9. Keep it under 120 words.

Examples:
- Input: "בפיג'מה בבית" → "wearing cozy cotton pajamas, relaxed at home on a comfortable sofa, warm ambient lighting from a table lamp, soft bokeh background of a living room, genuine warm smile, natural skin texture, highly detailed, sharp focus, professional photography, 8k quality"
- Input: "בחוף הים בשקיעה" → "standing on a sandy beach at golden hour sunset, warm orange and pink sky reflecting on the ocean, gentle sea breeze, relaxed casual summer outfit, natural sun-kissed skin, waves softly breaking in the background, cinematic composition, highly detailed, sharp focus, professional photography, 8k quality"
- Input: "professional headshot" → "professional corporate headshot portrait, clean neutral gray background, soft diffused studio lighting with subtle rim light, wearing a sharp business blazer, confident composed expression, shallow depth of field, highly detailed, sharp focus, professional photography, 8k quality"`;

        const result = await model.generateContent(
            `${systemInstruction}\n\nUser input: "${text}"`
        );
        const enhanced = result.response.text().trim();

        // Safety: if Gemini returned something weird or empty, fall back
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
 * Use when you just need Hebrew→English without adding style keywords.
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