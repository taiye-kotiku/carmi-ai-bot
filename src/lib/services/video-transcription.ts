// src/lib/services/video-transcription.ts
// Gemini transcribes video to Hebrew SRT

const apiKey = process.env.GOOGLE_AI_API_KEY!;

export interface SRTEntry {
    index: number;
    start: number; // seconds
    end: number;
    text: string;
}

/**
 * Transcribe video to Hebrew text using Gemini.
 * Returns SRT-style entries for burn-in.
 */
export async function transcribeVideoToHebrew(videoUrl: string): Promise<SRTEntry[]> {
    if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not set");

    const res = await fetch(videoUrl);
    if (!res.ok) throw new Error(`Failed to fetch video: ${res.status}`);
    const buf = await res.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: `You are a professional transcriber. Transcribe the video audio to Hebrew text.
Output a JSON array of segments: [{"start": seconds, "end": seconds, "text": "Hebrew text"}].
Each segment should be 2-5 seconds. Preserve Hebrew spelling and punctuation.
If the audio is not Hebrew, transcribe in the original language.
Return ONLY valid JSON, no markdown or extra text.`,
    });

    const result = await model.generateContent([
        {
            inlineData: {
                mimeType: "video/mp4",
                data: base64,
            },
        },
        {
            text: "Transcribe this video to Hebrew. Return JSON array: [{start, end, text}]",
        },
    ]);

    const text = result.response.text();
    const cleaned = text.replace(/```json?\s*/g, "").replace(/```\s*$/g, "").trim();
    let segments: Array<{ start: number; end: number; text: string }>;
    try {
        segments = JSON.parse(cleaned);
    } catch {
        // Fallback: return single segment with full text
        return [{ index: 1, start: 0, end: 60, text: text.slice(0, 200) }];
    }

    return segments.map((s, i) => ({
        index: i + 1,
        start: Number(s.start) || 0,
        end: Number(s.end) || 0,
        text: String(s.text || "").trim(),
    }));
}

/**
 * Convert SRT entries to SRT file content.
 */
export function srtEntriesToSrt(entries: SRTEntry[]): string {
    return entries
        .map(
            (e) =>
                `${e.index}\n${formatSrtTime(e.start)} --> ${formatSrtTime(e.end)}\n${e.text}\n`
        )
        .join("\n");
}

function formatSrtTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function pad(n: number, len = 2): string {
    return n.toString().padStart(len, "0");
}
