"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Loader2,
    Sparkles,
    Image,
    Video,
    LayoutGrid,
    ImageIcon,
    Link2,
    Download,
    CheckCircle2,
    XCircle,
    BookOpen,
} from "lucide-react";
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

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    story: BookOpen,
    carousel: LayoutGrid,
    video: Video,
    image: Image,
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
                        new Notification("היצירות הושלמו!", {
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

    return (
        <div className="pb-20 lg:pb-0" dir="rtl">
            <div className="max-w-5xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold mb-1 flex items-center gap-2">
                        <Sparkles className="h-6 w-6 sm:h-7 sm:w-7 text-purple-500" />
                        מרכז יצירתי
                    </h1>
                    <p className="text-gray-500 text-sm sm:text-base">
                        תיאור אחד - תמונה, קרוסלה, וידאו וסטורי במקביל
                    </p>
                </div>

                <div className="grid lg:grid-cols-5 gap-4 sm:gap-6">
                    {/* Controls - 3 cols on desktop */}
                    <div className="lg:col-span-3 space-y-4">
                        <Card className="shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base sm:text-lg">תיאור ומדיה</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium">תיאור (חובה)</Label>
                                    <Textarea
                                        placeholder="לדוגמה: קפה איכותי בשקיעה עם נוף לים..."
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        rows={4}
                                        disabled={isGenerating}
                                        className="min-h-[100px] text-base resize-none"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium">תמונה / קישור (אופציונלי)</Label>
                                    <div className="flex gap-2">
                                        {(["none", "image", "url"] as const).map((t) => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => setMediaType(t)}
                                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium min-h-[44px] transition-all duration-200 cursor-pointer ${
                                                    mediaType === t
                                                        ? "bg-purple-50 text-purple-700 border-2 border-purple-300"
                                                        : "bg-gray-50 text-gray-600 border-2 border-transparent hover:bg-gray-100"
                                                }`}
                                            >
                                                {t === "none" && "ללא"}
                                                {t === "image" && (
                                                    <>
                                                        <ImageIcon className="h-4 w-4" />
                                                        <span className="hidden sm:inline">תמונה</span>
                                                    </>
                                                )}
                                                {t === "url" && (
                                                    <>
                                                        <Link2 className="h-4 w-4" />
                                                        <span className="hidden sm:inline">קישור</span>
                                                    </>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                    {mediaType === "image" && (
                                        <div className="mt-2">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageChange}
                                                className="hidden"
                                                id="ch-image"
                                            />
                                            <label
                                                htmlFor="ch-image"
                                                className="flex flex-col items-center justify-center w-full min-h-[100px] border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors duration-200"
                                            >
                                                {imagePreview ? (
                                                    <img
                                                        src={imagePreview}
                                                        alt="תצוגה מקדימה"
                                                        className="max-h-28 object-contain rounded"
                                                    />
                                                ) : (
                                                    <span className="text-gray-400 text-sm">לחץ להעלאת תמונה</span>
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
                                            className="min-h-[48px] text-base mt-2"
                                        />
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium">סוגי תוכן</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(["story", "carousel", "video", "image"] as const).map((k) => {
                                            const Icon = TYPE_ICONS[k];
                                            return (
                                                <button
                                                    key={k}
                                                    type="button"
                                                    onClick={() => toggleOption(k)}
                                                    disabled={isGenerating}
                                                    className={`flex items-center gap-2.5 p-3 rounded-xl border-2 min-h-[52px] text-right transition-all duration-200 cursor-pointer ${
                                                        options[k]
                                                            ? "border-purple-400 bg-purple-50 text-purple-700"
                                                            : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                                                    }`}
                                                >
                                                    <Icon className="h-5 w-5 flex-shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <span className="font-medium text-sm">{TYPE_LABELS[k]}</span>
                                                    </div>
                                                    <span className="text-[11px] text-gray-400 flex-shrink-0">{TYPE_COSTS[k]}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Credits summary + Generate button - sticky on mobile */}
                                <div className="sticky bottom-20 lg:static lg:bottom-auto bg-white pt-3 pb-2 lg:pb-0 z-10 space-y-2 border-t border-gray-100 lg:border-0">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-500">
                                            {selectedCount > 0 ? `${selectedCount} סוגים נבחרו` : "בחר סוגי תוכן"}
                                        </span>
                                        <span className="font-semibold text-gray-700">
                                            {totalCost > 0 && `${totalCost} קרדיטים`}
                                            {!creditsLoading && totalCost > 0 && (
                                                <span className="text-gray-400 font-normal mr-1">
                                                    (יתרה: {credits})
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                    <Button
                                        onClick={handleGenerate}
                                        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/20"
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
                                                {totalCost > 0 ? `צור (${totalCost} קרדיטים)` : "צור"}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Results - 2 cols on desktop */}
                    <div className="lg:col-span-2 space-y-4">
                        <Card className="min-h-[300px] sm:min-h-[400px] shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base sm:text-lg">תוצאות</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {jobStates.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                        <Sparkles className="h-12 w-12 mb-3 opacity-20" />
                                        <p className="text-sm">התוצאות יופיעו כאן</p>
                                        <p className="text-xs mt-1 text-gray-300">ניתן לסגור את הדף - היצירה תמשיך ברקע</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {jobStates.map((job) => {
                                            const Icon = TYPE_ICONS[job.type] || Sparkles;
                                            return (
                                                <div
                                                    key={job.id}
                                                    className="p-3 sm:p-4 rounded-xl border border-gray-200 bg-white"
                                                >
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                                        <span className="font-medium text-sm flex-1">{TYPE_LABELS[job.type]}</span>
                                                        {job.status === "processing" && (
                                                            <span className="text-xs text-gray-400 flex items-center gap-1">
                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                                {job.progress ?? 0}%
                                                            </span>
                                                        )}
                                                        {job.status === "completed" && (
                                                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                        )}
                                                        {job.status === "failed" && (
                                                            <XCircle className="h-4 w-4 text-red-500" />
                                                        )}
                                                    </div>

                                                    {job.status === "processing" && (
                                                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-purple-500 transition-all duration-500 rounded-full"
                                                                style={{ width: `${job.progress ?? 0}%` }}
                                                            />
                                                        </div>
                                                    )}

                                                    {job.status === "completed" && job.result && (
                                                        <div className="mt-2 space-y-2">
                                                            {job.type === "video" && job.result.videoUrl && (
                                                                <div>
                                                                    <video
                                                                        src={job.result.videoUrl}
                                                                        controls
                                                                        className="w-full rounded-lg"
                                                                        playsInline
                                                                    />
                                                                    <a
                                                                        href={job.result.videoUrl}
                                                                        download
                                                                        className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 mt-1.5 cursor-pointer transition-colors"
                                                                    >
                                                                        <Download className="h-3.5 w-3.5" /> הורד
                                                                    </a>
                                                                </div>
                                                            )}
                                                            {job.type === "image" && (job.result.url || job.result.imageUrl) && (
                                                                <div>
                                                                    <img
                                                                        src={job.result.url || job.result.imageUrl}
                                                                        alt="תוצאה"
                                                                        className="w-full rounded-lg object-contain max-h-48"
                                                                        loading="lazy"
                                                                    />
                                                                    <a
                                                                        href={job.result.url || job.result.imageUrl}
                                                                        download
                                                                        className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 mt-1.5 cursor-pointer transition-colors"
                                                                    >
                                                                        <Download className="h-3.5 w-3.5" /> הורד
                                                                    </a>
                                                                </div>
                                                            )}
                                                            {job.type === "story" && (job.result.imageUrls || job.result.videoUrl) && (
                                                                <div className="flex gap-1.5 overflow-x-auto pb-1.5 -mx-1 px-1">
                                                                    {(job.result.imageUrls || []).map((url: string, i: number) => (
                                                                        <img
                                                                            key={i}
                                                                            src={url}
                                                                            alt={`פריים ${i + 1}`}
                                                                            className="h-20 w-auto rounded-lg object-cover flex-shrink-0"
                                                                            loading="lazy"
                                                                        />
                                                                    ))}
                                                                    {job.result.videoUrl && (
                                                                        <video
                                                                            src={job.result.videoUrl}
                                                                            className="h-20 rounded-lg flex-shrink-0"
                                                                            muted
                                                                            playsInline
                                                                        />
                                                                    )}
                                                                    <a
                                                                        href={job.result.videoUrl || job.result.imageUrls?.[0]}
                                                                        download
                                                                        className="inline-flex items-center gap-1 text-xs text-purple-600 self-center flex-shrink-0 cursor-pointer"
                                                                    >
                                                                        <Download className="h-3.5 w-3.5" /> הורד
                                                                    </a>
                                                                </div>
                                                            )}
                                                            {job.type === "carousel" && job.result.images && (
                                                                <div className="flex gap-1.5 overflow-x-auto pb-1.5 -mx-1 px-1">
                                                                    {job.result.images.slice(0, 3).map((url: string, i: number) => (
                                                                        <img
                                                                            key={i}
                                                                            src={url}
                                                                            alt={`שקופית ${i + 1}`}
                                                                            className="h-20 w-auto rounded-lg object-cover flex-shrink-0"
                                                                            loading="lazy"
                                                                        />
                                                                    ))}
                                                                    <span className="text-xs text-gray-400 self-center flex-shrink-0">
                                                                        +{job.result.images.length} שקופיות
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {job.status === "failed" && job.error && (
                                                        <p className="text-xs text-red-500 mt-1">{job.error}</p>
                                                    )}
                                                </div>
                                            );
                                        })}
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
