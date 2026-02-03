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
        maxClipNumber: options.maxClips || 10,
    };

    if (videoType === 1 && ext) {
        body.ext = ext;
    }

    console.log("=== VIZARD CREATE ===");
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
    console.log("Create response:", responseText);

    if (!response.ok) {
        throw new Error(`Vizard create error: ${responseText}`);
    }

    const data = JSON.parse(responseText);
    const projectId = data.projectId || data.project_id || data.data?.projectId;

    if (!projectId) {
        throw new Error("No project ID returned");
    }

    console.log("Project ID:", projectId);
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
    console.log("=== WAITING FOR PROJECT ===", projectId);

    const maxAttempts = 120; // 10 minutes (5s * 120)

    for (let i = 0; i < maxAttempts; i++) {
        // Wait 20 seconds between checks (like n8n workflow)
        await new Promise((r) => setTimeout(r, 20000));

        try {
            // Use the correct endpoint: /project/query/{projectId}
            const queryUrl = `${VIZARD_BASE_URL}/project/query/${projectId}`;
            console.log(`Poll ${i}: ${queryUrl}`);

            const response = await fetch(queryUrl, {
                headers: {
                    "VIZARDAI_API_KEY": VIZARD_API_KEY,
                },
            });

            const responseText = await response.text();
            console.log(`Poll ${i} response:`, responseText.slice(0, 500));

            if (!response.ok) {
                console.log(`Poll ${i}: HTTP error ${response.status}`);
                continue;
            }

            const data = JSON.parse(responseText);
            const code = data.code;

            console.log(`Poll ${i}: code=${code}`);

            // Update progress estimate
            if (onProgress) {
                const estimatedProgress = Math.min(10 + (i * 2), 80);
                await onProgress(estimatedProgress);
            }

            // Check response codes based on n8n workflow
            if (code === 2000) {
                // SUCCESS - videos are ready
                console.log("=== COMPLETED ===");
                const videos = data.videos || data.data?.videos || [];

                if (videos.length === 0) {
                    console.log("Full response:", JSON.stringify(data, null, 2));
                    throw new Error("No videos in completed response");
                }

                console.log(`Found ${videos.length} videos`);

                return videos.map((video: any) => ({
                    video_url: video.videoUrl || video.video_url || video.url,
                    thumbnail_url: video.coverUrl || video.thumbnail_url || video.cover,
                    title: video.title || video.name,
                    duration: video.duration,
                    start_time: video.startTime || video.start_time,
                    end_time: video.endTime || video.end_time,
                    transcript: video.transcript || video.subtitle,
                    virality_score: video.viralScore || video.virality_score || video.score,
                }));
            }

            if (code === 1000) {
                // STILL PROCESSING - continue waiting
                console.log(`Poll ${i}: Still processing...`);
                continue;
            }

            if (code === 4008) {
                // ERROR
                throw new Error(data.message || data.msg || "Vizard processing error (4008)");
            }

            // Unknown code - log and continue
            console.log(`Poll ${i}: Unknown code ${code}, continuing...`);

        } catch (error: any) {
            if (error.message.includes("No videos") || error.message.includes("error")) {
                throw error;
            }
            console.error(`Poll ${i} error:`, error.message);
        }
    }

    throw new Error("Vizard processing timed out after 40 minutes");
}

export async function getProjectStatus(projectId: string) {
    const response = await fetch(`${VIZARD_BASE_URL}/project/query/${projectId}`, {
        headers: {
            "VIZARDAI_API_KEY": VIZARD_API_KEY,
        },
    });

    const text = await response.text();
    const data = JSON.parse(text);

    return {
        code: data.code,
        status: data.code === 2000 ? "completed" : data.code === 1000 ? "processing" : "error",
        videos: data.videos,
    };
}