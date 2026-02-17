// src/lib/services/text-to-video-prompt.ts
// Enhances user prompts (Hebrew or English) for Veo 3.1 text-to-video generation

const apiKey = process.env.GOOGLE_AI_API_KEY!;

/**
 * Wraps the user's prompt in a detailed, cinematic prompt for best Veo 3.1 results.
 * Works with Hebrew and English prompts.
 */
export async function enhanceTextToVideoPrompt(userPrompt: string): Promise<string> {
    if (!apiKey) return userPrompt.trim();

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);

    const systemInstruction = `You are a professional Cinematographer and AI Prompt Engineer. Your task is to take a short user description (in Hebrew or English) and expand it into a highly detailed, technical prompt for the Veo 3.1 text-to-video generation model.

Instructions:

1. Preserve Intent: Keep the user's core idea, subject, and scene. Do not change the meaning.
2. Expand Visually: Add specific visual details—lighting (Golden Hour, Rim Lighting, soft shadows), textures, colors, atmosphere.
3. Add Cinematography: Include camera movement (Dolly, Pan, Orbit, static) and framing (wide shot, close-up, medium).
4. Motion & Physics: Describe natural movement, physics-based realism, subtle details (hair swaying, fabric movement, environmental elements).
5. Style & Mood: Add cinematic style, mood, and ambiance that match the scene.
6. Audio Hints: Veo 3.1 generates native audio. Include sound cues (ambient noise, dialogue, music style) when relevant.
7. Language: Output the enhanced prompt in English for best model compatibility, while preserving any Hebrew cultural/context elements in a way the model can interpret.

Output: A single flowing paragraph. No preamble, no quotes, no labels. Return ONLY the enhanced prompt.`;

    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction,
    });

    const trimmed = userPrompt?.trim();
    if (!trimmed) return "A cinematic scene with natural movement and professional lighting.";

    try {
        const result = await model.generateContent(
            `User's video description to enhance: ${trimmed}`
        );
        const text = result.response.text()?.trim();
        return text || trimmed;
    } catch (err) {
        console.error("[TextToVideo] Prompt enhancement failed:", err);
        return trimmed;
    }
}
