// src/lib/services/vizard.ts

const VIZARD_API_KEY = process.env.VIZARD_API_KEY!;
const VIZARD_BASE_URL =
    "https://elb-api.vizard.ai/hvizard-server-front/open-api/v1";

interface VizardOptions {
    language?: string;
    preferLength?: number[];
    aspectRatio?: "9:16" | "16:9" | "1:1" | "4:5";
    maxClips?: number;
    keywords?: string;
    projectName?: string;
    templateId?: number;
    removeSilence?: boolean;
    subtitles?: boolean;
    highlight?: boolean;
    autoBroll?: boolean;
    headline?: boolean;
    emoji?: boolean;
}

function getRatioOfClip(aspectRatio?: string): number {
    switch (aspectRatio) {
        case "9:16":
            return 1;
        case "1:1":
            return 2;
        case "4:5":
            return 3;
        case "16:9":
            return 4;
        default:
            return 1;
    }
}

function validatePreferLength(preferLength?: number[]): number[] {
    if (!preferLength || preferLength.length === 0) {
        return [0];
    }

    // Filter to only valid values: 0, 2, 3, 4
    // Value 1 (under 30 seconds) is blocked
    const valid = preferLength.filter((v) => [0, 2, 3, 4].includes(v));

    if (valid.length === 0) {
        return [0];
    }

    // Rule: 0 (auto) cannot be combined with other values
    if (valid.includes(0)) {
        return [0];
    }

    // Remove duplicates
    return [...new Set(valid)];
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
    if (lowerUrl.includes("streamyard.com")) {
        return { videoType: 5 };
    }
    if (lowerUrl.includes("tiktok.com")) {
        return { videoType: 6 };
    }
    if (lowerUrl.includes("twitter.com") || lowerUrl.includes("x.com")) {
        return { videoType: 7 };
    }
    if (lowerUrl.includes("twitch.tv")) {
        return { videoType: 9 };
    }
    if (lowerUrl.includes("loom.com")) {
        return { videoType: 10 };
    }
    if (lowerUrl.includes("facebook.com")) {
        return { videoType: 11 };
    }
    if (lowerUrl.includes("linkedin.com")) {
        return { videoType: 12 };
    }

    const ext =
        lowerUrl.match(/\.(mp4|mov|avi|3gp)(\?|$)/)?.[1] || "mp4";
    return { videoType: 1, ext };
}

export interface VizardVideo {
    videoId: number;
    videoUrl: string;
    videoMsDuration: number;
    title: string;
    transcript: string;
    viralScore: string;
    viralReason: string;
    relatedTopic: string;
    clipEditorUrl: string;
}

export interface CreateProjectResult {
    projectId: number;
    shareLink?: string;
}

export async function createProjectFromUrl(
    videoUrl: string,
    options: VizardOptions = {}
): Promise<CreateProjectResult> {
    if (!VIZARD_API_KEY) {
        throw new Error("VIZARD_API_KEY not configured");
    }

    const { videoType, ext } = detectVideoType(videoUrl);
    const preferLength = validatePreferLength(options.preferLength);

    const body: Record<string, any> = {
        videoUrl,
        videoType,
        lang: options.language || "auto",
        preferLength,
        ratioOfClip: getRatioOfClip(options.aspectRatio),
        removeSilenceSwitch: options.removeSilence ? 1 : 0,
        subtitleSwitch: options.subtitles !== false ? 1 : 0,
        highlightSwitch: options.highlight ? 1 : 0,
        autoBrollSwitch: options.autoBroll ? 1 : 0,
        headlineSwitch: options.headline !== false ? 1 : 0,
        emojiSwitch: options.emoji ? 1 : 0,
    };

    if (videoType === 1 && ext) {
        body.ext = ext;
    }

    if (options.maxClips && options.maxClips > 0 && options.maxClips <= 100) {
        body.maxClipNumber = options.maxClips;
    }

    if (options.keywords) {
        body.keywords = options.keywords;
    }

    if (options.templateId) {
        body.templateId = options.templateId;
    }

    if (options.projectName) {
        body.projectName = options.projectName;
    }

    console.log("[Vizard] Creating project:", JSON.stringify(body, null, 2));

    const response = await fetch(`${VIZARD_BASE_URL}/project/create`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            VIZARDAI_API_KEY: VIZARD_API_KEY,
        },
        body: JSON.stringify(body),
    });

    const responseText = await response.text();
    console.log("[Vizard] Create response:", responseText);

    let data: any;
    try {
        data = JSON.parse(responseText);
    } catch {
        throw new Error(
            `Vizard returned invalid JSON: ${responseText.substring(0, 200)}`
        );
    }

    if (data.code !== 2000) {
        const errorMessages: Record<number, string> = {
            4001: "מפתח API לא תקין",
            4002: "יצירת הפרויקט נכשלה",
            4003: "חריגה ממגבלת בקשות",
            4004: "פורמט וידאו לא נתמך",
            4005: "קובץ הוידאו פגום",
            4006: "פרמטר לא תקין",
            4007: "אין מספיק דקות בחשבון",
            4008: "לא ניתן להוריד את הוידאו מהקישור",
            4009: "קישור הוידאו לא תקין",
            4010: "לא ניתן לזהות את השפה בוידאו. נסה לבחור שפה ספציפית",
        };

        const msg =
            errorMessages[data.code] ||
            data.errMsg ||
            `Vizard error code: ${data.code}`;
        throw new Error(msg);
    }

    if (!data.projectId) {
        throw new Error("No projectId returned from Vizard");
    }

    console.log("[Vizard] Project created:", data.projectId);

    return {
        projectId: data.projectId,
        shareLink: data.shareLink,
    };
}

export async function queryProject(
    projectId: number | string
): Promise<{
    code: number;
    videos: VizardVideo[];
    projectName?: string;
    shareLink?: string;
} | null> {
    const response = await fetch(
        `${VIZARD_BASE_URL}/project/query/${projectId}`,
        {
            headers: {
                VIZARDAI_API_KEY: VIZARD_API_KEY,
            },
        }
    );

    const responseText = await response.text();

    let data: any;
    try {
        data = JSON.parse(responseText);
    } catch {
        console.error(
            "[Vizard] Invalid JSON from query:",
            responseText.substring(0, 300)
        );
        return null;
    }

    if (data.code === 1000) {
        return null;
    }

    if (data.code === 2000) {
        return {
            code: data.code,
            videos: data.videos || [],
            projectName: data.projectName,
            shareLink: data.shareLink,
        };
    }

    throw new Error(
        data.errMsg || `Vizard query error code: ${data.code}`
    );
}

export async function waitForProject(
    projectId: number | string,
    onProgress?: (progress: number) => Promise<void>
): Promise<VizardVideo[]> {
    console.log("[Vizard] Waiting for project:", projectId);

    const maxAttempts = 80;
    const pollInterval = 30000;

    for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, pollInterval));

        try {
            if (onProgress) {
                const estimatedProgress = Math.min(5 + i * 2, 90);
                await onProgress(estimatedProgress);
            }

            const result = await queryProject(projectId);

            if (result === null) {
                console.log(`[Vizard] Poll ${i + 1}: Still processing...`);
                continue;
            }

            if (result.videos.length === 0) {
                console.warn("[Vizard] Completed but no videos returned");
                throw new Error("הוידאו עובד אך לא נוצרו קליפים");
            }

            console.log(
                `[Vizard] Done! ${result.videos.length} videos ready.`
            );
            return result.videos;
        } catch (error: any) {
            if (
                error.message.includes("error code") ||
                error.message.includes("לא נוצרו")
            ) {
                throw error;
            }
            console.error(`[Vizard] Poll ${i + 1} error:`, error.message);
        }
    }

    throw new Error("עיבוד הוידאו לקח יותר מדי זמן (40 דקות)");
}

export async function getProjectStatus(projectId: number | string) {
    const response = await fetch(
        `${VIZARD_BASE_URL}/project/query/${projectId}`,
        {
            headers: {
                VIZARDAI_API_KEY: VIZARD_API_KEY,
            },
        }
    );

    const text = await response.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        return { code: -1, status: "error", videos: [] };
    }

    let status = "unknown";
    if (data.code === 2000) status = "completed";
    else if (data.code === 1000) status = "processing";
    else status = "error";

    return {
        code: data.code,
        status,
        videos: data.videos || [],
        projectName: data.projectName,
        shareLink: data.shareLink,
        errMsg: data.errMsg,
    };
}