// src/lib/services/prompt-enhancer.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

export async function enhancePrompt(text: string): Promise<string> {
    if (!process.env.GOOGLE_AI_API_KEY) {
        console.warn("GOOGLE_AI_API_KEY not set, skipping translation");
        return text;
    }

    try {
        // Simple check if text contains Hebrew letters
        const hasHebrew = /[\u0590-\u05FF]/.test(text);

        // If it's short English, maybe just return it to save time
        if (!hasHebrew && text.length < 20) return text;

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const systemInstruction = `
        You are an expert AI image prompt engineer.
        Your task is to translate and enhance user inputs into high-quality prompts for FLUX.1.
        
        Rules:
        1. Translate Hebrew to English perfectly.
        2. If the input is simple (e.g., "אישה בים"), add high-quality keywords (e.g., "professional photography, natural lighting, highly detailed").
        3. DO NOT add the trigger word (like 'ohwx'). The system adds that later.
        4. Keep the output as a single string of comma-separated keywords or a descriptive sentence.
        5. Output ONLY the prompt, no explanations.
        `;

        const result = await model.generateContent(`${systemInstruction}\n\nInput: "${text}"`);
        const enhancedPrompt = result.response.text().trim();

        console.log(`[Prompt] Original: "${text}" -> Enhanced: "${enhancedPrompt}"`);
        return enhancedPrompt;

    } catch (error) {
        console.error("Prompt enhancement failed:", error);
        return text; // Fallback to original if AI fails
    }
}