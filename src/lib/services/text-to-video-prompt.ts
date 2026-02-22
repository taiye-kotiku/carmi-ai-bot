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

CRITICAL RULES:
- NEVER invent or generate a new character/person. If the prompt mentions a person from an image or a provided character, the video must use ONLY that exact person - never substitute or create a different one.
- VIDEO STRUCTURE: If a reference person/image is mentioned in the prompt, the first 2-3 seconds should show that person with subtle natural animation (breathing, blinking, slight head movement). The remaining 5-6 seconds should transition to content directly relevant to the topic (product shots, scenery, demonstrations, relevant visuals).
- If NO reference person is mentioned, the full video should be about the topic with cinematic visuals.

Instructions:

1. Preserve Intent: Keep the user's core idea, subject, and scene. Do not change the meaning.
2. Expand Visually: Add specific visual details—lighting (Golden Hour, Rim Lighting, soft shadows), textures, colors, atmosphere.
3. Add Cinematography: Include camera movement (Dolly, Pan, Orbit, static) and framing (wide shot, close-up, medium).
4. Motion & Physics: Describe natural movement, physics-based realism, subtle details (hair swaying, fabric movement, environmental elements).
5. Style & Mood: Add cinematic style, mood, and ambiance that match the scene.
6. Topic-Relevant Content: After any opening with a person, the majority of the video (5-6 seconds) should showcase visuals directly relevant to the topic - products, environments, demonstrations, or scenery that match the user's description.
7. Audio & Dialogue: Veo 3.1 generates native audio with speech. If the user's prompt is in Hebrew or contains a Hebrew narration script, you MUST include the exact Hebrew dialogue in the prompt. Write it as: 'The person speaks in Hebrew: "[exact Hebrew text]"'. This is critical for generating proper Hebrew speech.
8. Hebrew Content: If the user's prompt is in Hebrew, ALL spoken dialogue, narration, voiceover, text overlays, signs, and written elements in the video MUST be in Hebrew. Never translate Hebrew content to English - keep Hebrew words in Hebrew script.
9. Language: Output the enhanced prompt in English for model compatibility, but embed any Hebrew dialogue/narration as-is in Hebrew script within the prompt.

10. NO TEXT ON VIDEO: Do NOT add any text overlays, titles, subtitles, captions, or written words on the video. The video must be purely visual and audio - no on-screen text.

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
