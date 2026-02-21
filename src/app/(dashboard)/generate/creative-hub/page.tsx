"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles, Image, Video, LayoutGrid, ImageIcon, Link2, Download } from "lucide-react";
import { toast } from "sonner";
import { useNotifications } from "@/lib/notifications/notification-context";
import { useCredits } from "@/hooks/use-credits";
import { CREDIT_COSTS } from "@/lib/config/credits";

const STORAGE_KEY = "creative-hub-jobIds";

type MediaType = "none" | "image" | "url";
type JobStatus = "pending" | "processing" | "completed" | "failed";

interface JobState {
    id: string;
    type: "story" | "carousel" | "video" | "image";
    status: JobStatus;
    progress?: number;
    result?: any;
    error?: string;
}

const TYPE_LABELS: Record<string, string> = {
    story: "סטורי",
    carousel: "קרוסלה",
    video: "וידאו",
    image: "תמונה",
};

const TYPE_COSTS: Record<string, number> = {
    story: CREDIT_COSTS.story_generation,
    carousel: CREDIT_COSTS.carousel_generation,
    video: CREDIT_COSTS.video_generation,
    image: CREDIT_COSTS.image_generation,
};

export default function CreativeHubPage() {
    const [prompt, setPrompt] = useState("");
    const [mediaType, setMediaType] = useState<MediaType>("none");
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [websiteUrl, setWebsiteUrl] = useState("");
    const [options, setOptions] = useState({ story: false, carousel: false, video: false, image: false });
    const [isGenerating, setIsGenerating] = useState(false);
    const [jobStates, setJobStates] = useState<JobState[]>([]);
    const pollRef = useRef<NodeJS.Timeout | null>(null);
    const allDoneNotified = useRef(false);

    const { addGenerationNotification } = useNotifications();
    const { credits, loading: creditsLoading, refresh: refreshCredits } = useCredits();

    const totalCost = Object.entries(options)
        .filter(([, v]) => v)
        .reduce((sum, [k]) => sum + (TYPE_COSTS[k] ?? 0), 0);

    const selectedCount = Object.values(options).filter(Boolean).length;

    const stopPolling = useCallback(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }, []);

    const pollJob = useCallback(
        async (job: JobState): Promise<JobState> => {
            try {
                const res = await fetch(`/api/jobs/${job.id}`);
                const data = await res.json();

                if (data.status === "completed") {
                    return { ...job, status: "completed", result: data.result };
                }
                if (data.status === "failed") {
                    return { ...job, status: "failed", error: data.error };
                }
                return {
                    ...job,
                    status: "processing",
                    progress: data.progress ?? job.progress,
                };
            } catch {
                return job;
            }
        },
        []
    );

    // Poll when we have processing jobs
    useEffect(() => {
        const pending = jobStates.filter((j) => j.status === "processing" || j.status === "pending");
        if (pending.length === 0) return;

        const t = setTimeout(async () => {
            const updates = await Promise.all(pending.map((j) => pollJob(j)));
            setJobStates((prev) => {
                const next = [...prev];
                for (const u of updates) {
                    const i = next.findIndex((j) => j.id === u.id);
                    if (i >= 0) next[i] = u;
                }
                const allDone = next.every((j) => j.status === "completed" || j.status === "failed");
                if (allDone && !allDoneNotified.current) {
                    allDoneNotified.current = true;
                    setIsGenerating(false);
                    refreshCredits();
                    addGenerationNotification("creative_hub", next.length);
                    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
                        new Notification("היצירות הושלמו! 🎉", {
                            body: `כל ${next.length} סוגי התוכן מוכנים`,
                            icon: "/favicon.ico",
                        });
                    }
                    sessionStorage.removeItem(STORAGE_KEY);
                }
                return next;
            });
        }, 2500);

        return () => clearTimeout(t);
    }, [jobStates, pollJob, refreshCredits, addGenerationNotification]);

    useEffect(() => {
        return () => stopPolling();
    }, [stopPolling]);

    // Restore from sessionStorage on mount
    useEffect(() => {
        try {
            const stored = sessionStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as Record<string, string>;
                const ids = Object.entries(parsed).map(([type, id]) => ({
                    id,
                    type: type as JobState["type"],
                    status: "processing" as JobStatus,
                }));
                if (ids.length > 0) {
                    setJobStates(ids);
                    setIsGenerating(true);
                    allDoneNotified.current = false;
                }
            }
        } catch {
            // ignore
        }
    }, []);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) {
            setImageFile(f);
            const reader = new FileReader();
            reader.onload = () => setImagePreview(reader.result as string);
            reader.readAsDataURL(f);
        } else {
            setImageFile(null);
            setImagePreview(null);
        }
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            toast.error("נא להזין תיאור");
            return;
        }
        if (selectedCount === 0) {
            toast.error("נא לבחור לפחות סוג תוכן אחד");
            return;
        }
        if (credits < totalCost) {
            toast.error(`אין מספיק קרדיטים. נדרשים ${totalCost}`);
            return;
        }

        setIsGenerating(true);
        allDoneNotified.current = false;
        setJobStates([]);

        try {
            let imageBase64: string | undefined;
            let imageMimeType: string | undefined;
            if (mediaType === "image" && imageFile) {
                imageBase64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const result = reader.result as string;
                        const base64 = result.includes(",") ? result.split(",")[1]! : result;
                        resolve(base64);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(imageFile);
                });
                imageMimeType = imageFile.type || "image/png";
            }

            const body: any = {
                prompt: prompt.trim(),
                options,
            };
            if (imageBase64) {
                body.imageBase64 = imageBase64;
                body.imageMimeType = imageMimeType;
            }
            if (mediaType === "url" && websiteUrl.trim()) {
                body.websiteUrl = websiteUrl.trim();
            }

            const res = await fetch("/api/generate/creative-hub", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || "שגיאה בשרת");
            }

            const jobIds = data.jobIds as Record<string, string>;
            const jobs: JobState[] = Object.entries(jobIds).map(([type, id]) => ({
                id,
                type: type as JobState["type"],
                status: "processing",
            }));

            setJobStates(jobs);
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(jobIds));
        } catch (err: any) {
            toast.error(err.message);
            setIsGenerating(false);
        }
    };

    const toggleOption = (key: keyof typeof options) => {
        setOptions((o) => ({ ...o, [key]: !o[key] }));
    };

    const allJobsDone = jobStates.length > 0 && jobStates.every((j) => j.status === "completed" || j.status === "failed");
    const hasResults = jobStates.some((j) => j.status === "completed" && j.result);

    return (
        <div className="container mx-auto py-8 px-4 pb-24 lg:pb-8" dir="rtl">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                        <Sparkles className="h-8 w-8 text-purple-500" />
                        מרכז יצירתי
                    </h1>
                    <p className="text-gray-600">
                        תיאור אחד – תמונה, קרוסלה, וידאו וסטורי במקביל
                    </p>
                </div>

                <div className="grid lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>תיאור ומידיה</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>תיאור (חובה)</Label>
                                    <Textarea
                                        placeholder="לדוגמה: קפה איכותי בשקיעה עם נוף לים..."
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        rows={4}
                                        disabled={isGenerating}
                                        className="min-h-[48px] text-base"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>תמונה / קישור (אופציונלי)</Label>
                                    <div className="flex gap-2 mb-2">
                                        {(["none", "image", "url"] as const).map((t) => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => setMediaType(t)}
                                                className={`px-3 py-2 rounded-lg text-sm font-medium min-h-[44px] ${
                                                    mediaType === t
                                                        ? "bg-purple-100 text-purple-700"
                                                        : "bg-gray-100 text-gray-600"
                                                }`}
                                            >
                                                {t === "none" && "ללא"}
                                                {t === "image" && (
                                                    <span className="flex items-center gap-1">
                                                        <ImageIcon className="h-4 w-4" /> תמונה
                                                    </span>
                                                )}
                                                {t === "url" && (
                                                    <span className="flex items-center gap-1">
                                                        <Link2 className="h-4 w-4" /> קישור
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                    {mediaType === "image" && (
                                        <div>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageChange}
                                                className="hidden"
                                                id="ch-image"
                                            />
                                            <label
                                                htmlFor="ch-image"
                                                className="flex flex-col items-center justify-center w-full min-h-[120px] border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
                                            >
                                                {imagePreview ? (
                                                    <img
                                                        src={imagePreview}
                                                        alt="Preview"
                                                        className="max-h-32 object-contain"
                                                    />
                                                ) : (
                                                    <span className="text-gray-500 text-sm">לחץ להעלאת תמונה</span>
                                                )}
                                            </label>
                                        </div>
                                    )}
                                    {mediaType === "url" && (
                                        <Input
                                            placeholder="https://example.com/article"
                                            value={websiteUrl}
                                            onChange={(e) => setWebsiteUrl(e.target.value)}
                                            disabled={isGenerating}
                                            className="min-h-[48px] text-base"
                                        />
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label>סוגי תוכן</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(["story", "carousel", "video", "image"] as const).map((k) => (
                                            <button
                                                key={k}
                                                type="button"
                                                onClick={() => toggleOption(k)}
                                                disabled={isGenerating}
                                                className={`flex items-center gap-2 p-3 rounded-xl border min-h-[48px] text-right ${
                                                    options[k]
                                                        ? "border-purple-500 bg-purple-50 text-purple-700"
                                                        : "border-gray-200 text-gray-600"
                                                }`}
                                            >
                                                {k === "story" && <LayoutGrid className="h-5 w-5" />}
                                                {k === "carousel" && <LayoutGrid className="h-5 w-5" />}
                                                {k === "video" && <Video className="h-5 w-5" />}
                                                {k === "image" && <Image className="h-5 w-5" />}
                                                <span>{TYPE_LABELS[k]}</span>
                                                <span className="text-xs text-gray-500">({TYPE_COSTS[k]} קרדיט)</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-2 flex flex-col gap-2">
                                    <p className="text-sm text-gray-600">
                                        סה״כ: {totalCost} קרדיטים • יתרה: {creditsLoading ? "..." : credits}
                                    </p>
                                    <Button
                                        onClick={handleGenerate}
                                        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white min-h-[48px] text-base"
                                        size="lg"
                                        disabled={
                                            isGenerating ||
                                            !prompt.trim() ||
                                            selectedCount === 0 ||
                                            credits < totalCost ||
                                            creditsLoading
                                        }
                                    >
                                        {isGenerating ? (
                                            <>
                                                <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                                                מייצר...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="ml-2 h-5 w-5" />
                                                צור ({totalCost} קרדיטים)
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <Card className="min-h-[400px]">
                            <CardHeader>
                                <CardTitle>תוצאות</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {jobStates.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                        <Sparkles className="h-16 w-16 mb-4 opacity-20" />
                                        <p>התוצאות יופיעו כאן</p>
                                        <p className="text-sm mt-2">ניתן לסגור את הדף – היצירה תמשיך ברקע</p>
                                    </div>
                                ) : (
                                    <div className="grid gap-4">
                                        {jobStates.map((job) => (
                                            <div
                                                key={job.id}
                                                className="p-4 rounded-xl border border-gray-200 bg-gray-50/50"
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-medium">{TYPE_LABELS[job.type]}</span>
                                                    {job.status === "processing" && (
                                                        <span className="text-sm text-gray-500">
                                                            {job.progress ?? 0}%
                                                        </span>
                                                    )}
                                                    {job.status === "completed" && (
                                                        <span className="text-sm text-green-600">✓ הושלם</span>
                                                    )}
                                                    {job.status === "failed" && (
                                                        <span className="text-sm text-red-600">נכשל</span>
                                                    )}
                                                </div>
                                                {job.status === "processing" && (
                                                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-purple-500 transition-all"
                                                            style={{ width: `${job.progress ?? 0}%` }}
                                                        />
                                                    </div>
                                                )}
                                                {job.status === "completed" && job.result && (
                                                    <div className="mt-3 space-y-2">
                                                        {job.type === "video" && job.result.videoUrl && (
                                                            <div>
                                                                <video
                                                                    src={job.result.videoUrl}
                                                                    controls
                                                                    className="w-full rounded-lg max-h-48"
                                                                />
                                                                <a
                                                                    href={job.result.videoUrl}
                                                                    download
                                                                    className="inline-flex items-center gap-1 text-sm text-purple-600 mt-2"
                                                                >
                                                                    <Download className="h-4 w-4" /> הורד
                                                                </a>
                                                            </div>
                                                        )}
                                                        {job.type === "image" && (job.result.url || job.result.imageUrl) && (
                                                            <div>
                                                                <img
                                                                    src={job.result.url || job.result.imageUrl}
                                                                    alt="Result"
                                                                    className="w-full rounded-lg max-h-48 object-contain"
                                                                />
                                                                <a
                                                                    href={job.result.url || job.result.imageUrl}
                                                                    download
                                                                    className="inline-flex items-center gap-1 text-sm text-purple-600 mt-2"
                                                                >
                                                                    <Download className="h-4 w-4" /> הורד
                                                                </a>
                                                            </div>
                                                        )}
                                                        {job.type === "story" && (job.result.imageUrls || job.result.videoUrl) && (
                                                            <div className="flex gap-2 overflow-x-auto pb-2">
                                                                {(job.result.imageUrls || []).map((url: string, i: number) => (
                                                                    <img
                                                                        key={i}
                                                                        src={url}
                                                                        alt={`Frame ${i + 1}`}
                                                                        className="h-24 w-auto rounded-lg object-cover flex-shrink-0"
                                                                    />
                                                                ))}
                                                                {job.result.videoUrl && (
                                                                    <video
                                                                        src={job.result.videoUrl}
                                                                        className="h-24 rounded-lg flex-shrink-0"
                                                                        muted
                                                                        playsInline
                                                                    />
                                                                )}
                                                                <a
                                                                    href={job.result.videoUrl || job.result.imageUrls?.[0]}
                                                                    download
                                                                    className="inline-flex items-center gap-1 text-sm text-purple-600 self-center"
                                                                >
                                                                    <Download className="h-4 w-4" /> הורד
                                                                </a>
                                                            </div>
                                                        )}
                                                        {job.type === "carousel" && job.result.images && (
                                                            <div className="flex gap-2 overflow-x-auto pb-2">
                                                                {job.result.images.slice(0, 3).map((url: string, i: number) => (
                                                                    <img
                                                                        key={i}
                                                                        src={url}
                                                                        alt={`Slide ${i + 1}`}
                                                                        className="h-24 w-auto rounded-lg object-cover flex-shrink-0"
                                                                    />
                                                                ))}
                                                                <span className="text-sm text-gray-500 self-center">
                                                                    +{job.result.images.length} שקופיות
                                                                </span>
                                                                <a
                                                                    href={job.result.images[0]}
                                                                    download
                                                                    className="inline-flex items-center gap-1 text-sm text-purple-600 self-center"
                                                                >
                                                                    <Download className="h-4 w-4" /> הורד
                                                                </a>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {job.status === "failed" && job.error && (
                                                    <p className="text-sm text-red-600 mt-1">{job.error}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
