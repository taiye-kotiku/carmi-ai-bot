// src/lib/services/veo-extend.ts
// Extends an 8s Veo video by 7s to reach ~15s total (8 + 7)

const apiKey = process.env.GOOGLE_AI_API_KEY!;
const VEO_EXTEND_MODEL = "veo-3.1-fast-generate-preview";

export interface ExtendResult {
    videoUri: string;
    extendedDuration: number;
}

/**
 * Extend a Veo-generated video by 7 seconds.
 * Input must be Veo-generated, MP4, 24fps, 720p/1080p.
 * Returns the extended video URI (15s total).
 */
export async function extendVeoVideo(
    videoUrl: string,
    continuationPrompt?: string
): Promise<ExtendResult> {
    if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not set");

    // Download video and convert to base64
    const res = await fetch(videoUrl);
    if (!res.ok) throw new Error(`Failed to fetch video: ${res.status}`);
    const buf = await res.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");

    const prompt = continuationPrompt || "Continue the scene naturally with the same style, lighting, and action.";

    const startResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${VEO_EXTEND_MODEL}:predictLongRunning?key=${apiKey}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                instances: [{
                    prompt,
                    video: {
                        bytesBase64Encoded: base64,
                        mimeType: "video/mp4",
                    },
                }],
                parameters: {
                    sampleCount: 1,
                },
            }),
        }
    );

    if (!startResponse.ok) {
        const errText = await startResponse.text();
        throw new Error(`Veo extend failed: ${errText}`);
    }

    const operation = await startResponse.json();
    const operationName = operation.name;

    // Poll for completion (up to ~3 min)
    for (let i = 0; i < 90; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const pollRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`
        );
        if (!pollRes.ok) continue;
        const pollData = await pollRes.json();
        if (pollData.error) throw new Error(pollData.error.message);
        if (!pollData.done) continue;

        const videoUri = extractVideoUriFromPoll(pollData);
        if (videoUri) {
            return { videoUri, extendedDuration: 15 };
        }
    }

    throw new Error("Veo extend timed out");
}

function extractVideoUriFromPoll(pollData: any): string | null {
    const resp = pollData.response || pollData.result || {};
    const genResp = resp.generateVideoResponse || resp;
    const generatedVideos = resp.generatedVideos || genResp.generatedVideos || [];
    if (generatedVideos.length > 0) {
        const gv = generatedVideos[0];
        const vid = gv.video || gv;
        const uri = vid?.uri || vid?.videoUri || gv.uri || gv.videoUri || null;
        if (uri) return uri;
        const fileRef = vid?.name || vid?.file?.name || gv.name;
        if (fileRef && typeof fileRef === "string") {
            const fileId = fileRef.startsWith("files/") ? fileRef : `files/${fileRef}`;
            return `https://generativelanguage.googleapis.com/v1beta/${fileId}?alt=media&key=${apiKey}`;
        }
    }
    const preds = resp.predictions || [];
    if (preds.length > 0) {
        const p = preds[0];
        return p.videoUri || p.uri || p.video?.uri || null;
    }
    return null;
}
