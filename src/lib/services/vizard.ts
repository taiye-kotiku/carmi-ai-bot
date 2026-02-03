const VIZARD_API_KEY = process.env.VIZARD_API_KEY!;
const VIZARD_BASE_URL = "https://elb-api.vizard.ai/hvizard-server-front/open-api/v1";

interface VizardOptions {
    language?: string;
    clipLength?: "short" | "medium" | "long";
    aspectRatio?: "9:16" | "16:9" | "1:1";
    maxClips?: number;
}

// Map clip length to Vizard preferLength values
function getPreferLength(clipLength?: string): number[] {
    switch (clipLength) {
        case "short":
            return [1]; // <30s
        case "medium":
            return [2, 3]; // 30-90s
        case "long":
            return [4]; // 90s-3min
        default:
            return [0]; // auto
    }
}

// Detect video type from URL
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
    if (lowerUrl.includes("facebook.com") || lowerUrl.includes("fb.com")) {
        return { videoType: 11 };
    }
    if (lowerUrl.includes("linkedin.com")) {
        return { videoType: 12 };
    }

    // Default: remote file
    const ext = lowerUrl.match(/\.(mp4|mov|avi|3gp)(\?|$)/)?.[1] || "mp4";
    return { videoType: 1, ext };
}

export async function createProjectFromUrl(
    videoUrl: string,
    options: VizardOptions = {}
): Promise<string> {
    const { videoType, ext } = detectVideoType(videoUrl);

    const body: any = {
        videoUrl,
        videoType,
        lang: options.language || "auto",
        preferLength: getPreferLength(options.clipLength),
    };

    // ext required only for videoType 1 (remote file)
    if (videoType === 1 && ext) {
        body.ext = ext;
    }

    console.log("Vizard create request:", body);

    const response = await fetch(`${VIZARD_BASE_URL}/project/create`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "VIZARDAI_API_KEY": VIZARD_API_KEY,
        },
        body: JSON.stringify(body),
    });

    const responseText = await response.text();
    console.log("Vizard create response:", responseText);

    if (!response.ok) {
        throw new Error(`Vizard API error: ${responseText}`);
    }

    const data = JSON.parse(responseText);
    const projectId = data.projectId || data.data?.projectId || data.project_id;

    if (!projectId) {
        throw new Error("No project ID returned from Vizard");
    }

    return projectId;
}

export async function createProjectFromFile(
    videoBuffer: Buffer,
    fileName: string,
    options: VizardOptions = {}
): Promise<string> {
    // For file uploads, we need to use the upload endpoint
    // First check if Vizard has a file upload endpoint, or if we need to
    // upload to our storage first and then use the URL

    // Based on docs, Vizard works with URLs, so we'll need the caller
    // to upload the file first and provide a URL
    throw new Error("Direct file upload not supported - please provide a URL");
}

export async function waitForProject(
    projectId: string,
    onProgress?: (progress: number) => Promise<void>
): Promise<any[]> {
    const maxAttempts = 120; // 10 minutes

    for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, 5000));

        try {
            const response = await fetch(`${VIZARD_BASE_URL}/project/${projectId}`, {
                headers: {
                    "VIZARDAI_API_KEY": VIZARD_API_KEY,
                },
            });

            if (!response.ok) {
                console.log(`Poll ${i}: status ${response.status}`);
                continue;
            }

            const data = await response.json();
            const projectData = data.data || data;

            console.log(`Poll ${i}: status=${projectData.status}, progress=${projectData.progress}`);

            // Update progress
            if (onProgress && projectData.progress) {
                await onProgress(projectData.progress);
            }

            // Check if completed
            if (projectData.status === "completed" || projectData.status === "done") {
                const clips = projectData.clips || projectData.videos || [];

                if (clips.length === 0) {
                    throw new Error("No clips generated");
                }

                return clips.map((clip: any) => ({
                    video_url: clip.video_url || clip.videoUrl || clip.url,
                    thumbnail_url: clip.thumbnail_url || clip.thumbnailUrl || clip.thumbnail,
                    title: clip.title || clip.name,
                    duration: clip.duration,
                    start_time: clip.start_time || clip.startTime,
                    end_time: clip.end_time || clip.endTime,
                    transcript: clip.transcript,
                    virality_score: clip.virality_score || clip.viralityScore || clip.score,
                }));
            }

            if (projectData.status === "failed" || projectData.status === "error") {
                throw new Error(projectData.error || "Vizard processing failed");
            }

        } catch (error: any) {
            if (error.message.includes("failed") || error.message.includes("No clips")) {
                throw error;
            }
            console.error(`Poll ${i} error:`, error.message);
        }
    }

    throw new Error("Vizard processing timed out");
}

export async function getProjectStatus(projectId: string): Promise<{
    status: string;
    progress: number;
    clips?: any[];
}> {
    const response = await fetch(`${VIZARD_BASE_URL}/project/${projectId}`, {
        headers: {
            "VIZARDAI_API_KEY": VIZARD_API_KEY,
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to get project status: ${response.status}`);
    }

    const data = await response.json();
    const projectData = data.data || data;

    return {
        status: projectData.status,
        progress: projectData.progress || 0,
        clips: projectData.clips,
    };
}