const VIZARD_API_KEY = process.env.VIZARD_API_KEY!;
const VIZARD_BASE_URL = "https://elb-api.vizard.ai/hvizard-server-front/open-api/v1";

interface VizardOptions {
    language?: string;
    clipLength?: "short" | "medium" | "long";
    aspectRatio?: "9:16" | "16:9" | "1:1";
    maxClips?: number;
}

function getPreferLength(clipLength?: string): number[] {
    switch (clipLength) {
        case "short": return [1];
        case "medium": return [2, 3];
        case "long": return [4];
        default: return [0];
    }
}

function detectVideoType(url: string): { videoType: number; ext?: string } {
    const lowerUrl = url.toLowerCase();

    if (lowerUrl.includes("youtube.com") || lowerUrl.includes("youtu.be")) {
        return { videoType: 2 };
    }
    if (lowerUrl.includes("drive.google.com")) {
        return { videoType: 3 };
    }
    if (lowerUrl.includes("vimeo.com")) {
        return { videoType: 4 };
    }
    if (lowerUrl.includes("tiktok.com")) {
        return { videoType: 6 };
    }
    if (lowerUrl.includes("twitter.com") || lowerUrl.includes("x.com")) {
        return { videoType: 7 };
    }
    if (lowerUrl.includes("facebook.com")) {
        return { videoType: 11 };
    }
    if (lowerUrl.includes("linkedin.com")) {
        return { videoType: 12 };
    }

    const ext = lowerUrl.match(/\.(mp4|mov|avi|3gp)(\?|$)/)?.[1] || "mp4";
    return { videoType: 1, ext };
}

export async function createProjectFromUrl(
    videoUrl: string,
    options: VizardOptions = {}
): Promise<string> {
    if (!VIZARD_API_KEY) {
        throw new Error("VIZARD_API_KEY not configured");
    }

    const { videoType, ext } = detectVideoType(videoUrl);

    const body: any = {
        videoUrl,
        videoType,
        lang: options.language || "auto",
        preferLength: getPreferLength(options.clipLength),
    };

    if (videoType === 1 && ext) {
        body.ext = ext;
    }

    console.log("=== VIZARD CREATE ===");
    console.log("URL:", `${VIZARD_BASE_URL}/project/create`);
    console.log("Body:", JSON.stringify(body, null, 2));

    const response = await fetch(`${VIZARD_BASE_URL}/project/create`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "VIZARDAI_API_KEY": VIZARD_API_KEY,
        },
        body: JSON.stringify(body),
    });

    const responseText = await response.text();
    console.log("Response status:", response.status);
    console.log("Response body:", responseText);

    if (!response.ok) {
        throw new Error(`Vizard error ${response.status}: ${responseText}`);
    }

    const data = JSON.parse(responseText);

    // Try different response structures
    const projectId =
        data.projectId ||
        data.project_id ||
        data.data?.projectId ||
        data.data?.project_id ||
        data.id;

    console.log("Project ID:", projectId);

    if (!projectId) {
        console.error("Full response:", JSON.stringify(data, null, 2));
        throw new Error("No project ID in response");
    }

    return projectId;
}

export async function createProjectFromFile(
    videoBuffer: Buffer,
    fileName: string,
    options: VizardOptions = {}
): Promise<string> {
    throw new Error("Direct file upload not supported - upload to storage first");
}

export async function waitForProject(
    projectId: string,
    onProgress?: (progress: number) => Promise<void>
): Promise<any[]> {
    console.log("=== WAITING FOR PROJECT ===");
    console.log("Project ID:", projectId);

    const maxAttempts = 120;

    for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, 5000));

        try {
            // Try different endpoint formats
            const endpoints = [
                `${VIZARD_BASE_URL}/project/${projectId}`,
                `${VIZARD_BASE_URL}/project/status/${projectId}`,
                `${VIZARD_BASE_URL}/project?projectId=${projectId}`,
            ];

            let data: any = null;
            let responseOk = false;

            for (const endpoint of endpoints) {
                if (responseOk) break;

                console.log(`Poll ${i} - trying: ${endpoint}`);

                const response = await fetch(endpoint, {
                    headers: {
                        "VIZARDAI_API_KEY": VIZARD_API_KEY,
                    },
                });

                if (response.ok) {
                    const text = await response.text();
                    console.log(`Poll ${i} response:`, text.slice(0, 500));

                    try {
                        data = JSON.parse(text);
                        responseOk = true;
                    } catch (e) {
                        console.log("Parse error:", e);
                    }
                }
            }

            if (!data) {
                console.log(`Poll ${i}: No valid response`);
                continue;
            }

            const projectData = data.data || data;
            const status = projectData.status || projectData.state;
            const progress = projectData.progress || projectData.percent || 0;

            console.log(`Poll ${i}: status=${status}, progress=${progress}`);

            if (onProgress) {
                await onProgress(progress);
            }

            // Check for completion
            if (status === "completed" || status === "done" || status === "finished" || status === "success") {
                const clips =
                    projectData.clips ||
                    projectData.videos ||
                    projectData.results ||
                    projectData.data?.clips ||
                    [];

                console.log("Clips found:", clips.length);

                if (clips.length === 0) {
                    // Maybe clips are in a different format
                    console.log("Full projectData:", JSON.stringify(projectData, null, 2));
                    throw new Error("No clips in completed project");
                }

                return clips.map((clip: any) => ({
                    video_url: clip.video_url || clip.videoUrl || clip.url || clip.video,
                    thumbnail_url: clip.thumbnail_url || clip.thumbnailUrl || clip.thumbnail || clip.cover,
                    title: clip.title || clip.name || clip.headline,
                    duration: clip.duration || clip.length,
                    start_time: clip.start_time || clip.startTime || clip.start,
                    end_time: clip.end_time || clip.endTime || clip.end,
                    transcript: clip.transcript || clip.text || clip.subtitle,
                    virality_score: clip.virality_score || clip.viralityScore || clip.score,
                }));
            }

            if (status === "failed" || status === "error") {
                throw new Error(projectData.error || projectData.message || "Processing failed");
            }

        } catch (error: any) {
            if (error.message.includes("failed") || error.message.includes("No clips")) {
                throw error;
            }
            console.error(`Poll ${i} error:`, error.message);
        }
    }

    throw new Error("Processing timed out after 10 minutes");
}

export async function getProjectStatus(projectId: string) {
    const response = await fetch(`${VIZARD_BASE_URL}/project/${projectId}`, {
        headers: {
            "VIZARDAI_API_KEY": VIZARD_API_KEY,
        },
    });

    const text = await response.text();
    console.log("Status response:", text);

    if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
    }

    const data = JSON.parse(text);
    const projectData = data.data || data;

    return {
        status: projectData.status,
        progress: projectData.progress || 0,
        clips: projectData.clips,
    };
}