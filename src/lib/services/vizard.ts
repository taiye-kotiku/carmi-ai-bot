const VIZARD_API_KEY = process.env.VIZARD_API_KEY!;
const VIZARD_API_URL = "https://api.vizard.ai/v1";

interface VizardProject {
    id: string;
    status: string;
    clips?: VizardClip[];
}

interface VizardClip {
    id: string;
    title: string;
    duration: number;
    start_time: number;
    end_time: number;
    video_url: string;
    thumbnail_url: string;
    transcript: string;
    virality_score: number;
}

interface CreateProjectOptions {
    videoUrl?: string;
    videoFile?: Buffer;
    language?: string;
    clipLength?: "short" | "medium" | "long";
    aspectRatio?: "9:16" | "16:9" | "1:1";
    maxClips?: number;
}

// Create a new project from video URL
export async function createProjectFromUrl(
    videoUrl: string,
    options: Omit<CreateProjectOptions, "videoUrl" | "videoFile"> = {}
): Promise<string> {
    const response = await fetch(`${VIZARD_API_URL}/projects`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${VIZARD_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            video_url: videoUrl,
            language: options.language || "he",
            clip_length: options.clipLength || "short",
            aspect_ratio: options.aspectRatio || "9:16",
            max_clips: options.maxClips || 10,
            auto_caption: true,
            caption_style: "modern",
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create Vizard project");
    }

    const data = await response.json();
    return data.project_id;
}

// Upload video file directly
export async function createProjectFromFile(
    videoBuffer: Buffer,
    fileName: string,
    options: Omit<CreateProjectOptions, "videoUrl" | "videoFile"> = {}
): Promise<string> {
    // First, get upload URL
    const uploadResponse = await fetch(`${VIZARD_API_URL}/upload-url`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${VIZARD_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            file_name: fileName,
            file_size: videoBuffer.length,
        }),
    });

    if (!uploadResponse.ok) {
        throw new Error("Failed to get upload URL");
    }

    const { upload_url, file_id } = await uploadResponse.json();

    // ✅ FIX: Convert Buffer to Uint8Array for fetch body
    const uint8Array = new Uint8Array(videoBuffer);

    // Upload the file
    await fetch(upload_url, {
        method: "PUT",
        headers: {
            "Content-Type": "video/mp4",
        },
        body: uint8Array,
    });

    // Create project with uploaded file
    const response = await fetch(`${VIZARD_API_URL}/projects`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${VIZARD_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            file_id: file_id,
            language: options.language || "he",
            clip_length: options.clipLength || "short",
            aspect_ratio: options.aspectRatio || "9:16",
            max_clips: options.maxClips || 10,
            auto_caption: true,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create project");
    }

    const data = await response.json();
    return data.project_id;
}

// Get project status and clips
export async function getProject(projectId: string): Promise<VizardProject> {
    const response = await fetch(`${VIZARD_API_URL}/projects/${projectId}`, {
        headers: {
            "Authorization": `Bearer ${VIZARD_API_KEY}`,
        },
    });

    if (!response.ok) {
        throw new Error("Failed to get project");
    }

    return response.json();
}

// Get all clips for a project
export async function getClips(projectId: string): Promise<VizardClip[]> {
    const response = await fetch(`${VIZARD_API_URL}/projects/${projectId}/clips`, {
        headers: {
            "Authorization": `Bearer ${VIZARD_API_KEY}`,
        },
    });

    if (!response.ok) {
        throw new Error("Failed to get clips");
    }

    const data = await response.json();
    return data.clips;
}

// Download a specific clip
export async function downloadClip(clipId: string): Promise<Buffer> {
    const response = await fetch(`${VIZARD_API_URL}/clips/${clipId}/download`, {
        headers: {
            "Authorization": `Bearer ${VIZARD_API_KEY}`,
        },
    });

    if (!response.ok) {
        throw new Error("Failed to download clip");
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

// Poll for project completion
export async function waitForProject(
    projectId: string,
    onProgress?: (progress: number) => void,
    maxWaitTime: number = 600000 // 10 minutes
): Promise<VizardClip[]> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
        const project = await getProject(projectId);

        if (project.status === "completed") {
            return project.clips || [];
        }

        if (project.status === "failed") {
            throw new Error("Project processing failed");
        }

        // Estimate progress based on status
        const progressMap: Record<string, number> = {
            "queued": 10,
            "uploading": 20,
            "transcribing": 40,
            "analyzing": 60,
            "generating": 80,
            "finalizing": 90,
        };

        if (onProgress && progressMap[project.status]) {
            onProgress(progressMap[project.status]);
        }

        // Wait 5 seconds before next check
        await new Promise(resolve => setTimeout(resolve, 5000));
    }

    throw new Error("Project timed out");
}