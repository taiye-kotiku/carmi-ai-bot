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
    Globe,
    FileText,
    Wand2,
    RefreshCw,
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
    statusText?: string;
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

const STEPS_INFO: Record<string, string[]> = {
    story: [
        "יצירת 4 תמונות אנכיות לסטורי",
        "שמירה וסיום",
    ],
    carousel: [
        "יצירת תוכן טקסט לשקופיות",
        "עיצוב שקופיות הקרוסלה",
        "שמירה וסיום",
    ],
    video: [
        "שיפור פרומפט עם AI",
        "יצירת וידאו (עד 3 דקות)",
        "הורדה ושמירה",
    ],
    image: [
        "יצירת תמונה באמצעות AI",
        "שמירה וסיום",
    ],
};

export default function CreativeHubPage() {
    const [prompt, setPrompt] = useState("");
    const [mediaType, setMediaType] = useState<MediaType>("none");
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [websiteUrl, setWebsiteUrl] = useState("");
    const [options, setOptions] = useState({
        story: false,
        carousel: false,
        video: false,
        image: false,
    });
    const [isGenerating, setIsGenerating] = useState(false);
    const [jobStates, setJobStates] = useState<JobState[]>([]);
    const [globalStatus, setGlobalStatus] = useState("");
    const allDoneNotified = useRef(false);
    const completedJobsRef = useRef(new Set<string>());

    const { addGenerationNotification } = useNotifications();
    const {
        credits,
        loading: creditsLoading,
        refresh: refreshCredits,
    } = useCredits();

    const totalCost = Object.entries(options)
        .filter(([, v]) => v)
        .reduce((sum, [k]) => sum + (TYPE_COSTS[k] ?? 0), 0);

    const selectedCount = Object.values(options).filter(Boolean).length;

    const pollJob = useCallback(
        async (job: JobState): Promise<JobState> => {
            try {
                const res = await fetch(`/api/jobs/${job.id}`);
                const data = await res.json();

                if (data.status === "completed") {
                    return {
                        ...job,
                        status: "completed",
                        progress: 100,
                        result: data.result,
                        statusText: data.statusText || "הושלם!",
                    };
                }
                if (data.status === "failed") {
                    return {
                        ...job,
                        status: "failed",
                        error: data.error,
                        statusText: data.statusText || "נכשל",
                    };
                }
                return {
                    ...job,
                    status: "processing",
                    progress: data.progress ?? job.progress,
                    statusText: data.statusText || "מעבד...",
                };
            } catch {
                return job;
            }
        },
        []
    );

    useEffect(() => {
        const pending = jobStates.filter(
            (j) => j.status === "processing" || j.status === "pending"
        );
        if (pending.length === 0) return;

        const completed = jobStates.filter((j) => j.status === "completed").length;
        const total = jobStates.length;
        setGlobalStatus(
            `${completed} מתוך ${total} סוגי תוכן הושלמו`
        );

        const t = setTimeout(async () => {
            const updates = await Promise.all(pending.map((j) => pollJob(j)));
            setJobStates((prev) => {
                const next = [...prev];
                for (const u of updates) {
                    const i = next.findIndex((j) => j.id === u.id);
                    if (i >= 0) {
                        const wasProcessing =
                            next[i].status === "processing" ||
                            next[i].status === "pending";
                        next[i] = u;

                        if (
                            wasProcessing &&
                            u.status === "completed" &&
                            !completedJobsRef.current.has(u.id)
                        ) {
                            completedJobsRef.current.add(u.id);
                            toast.success(
                                `${TYPE_LABELS[u.type]} הושלם בהצלחה!`
                            );
                        }
                        if (
                            wasProcessing &&
                            u.status === "failed" &&
                            !completedJobsRef.current.has(u.id)
                        ) {
                            completedJobsRef.current.add(u.id);
                            toast.error(
                                `${TYPE_LABELS[u.type]} נכשל: ${u.error || "שגיאה"}`
                            );
                        }
                    }
                }

                const allDone = next.every(
                    (j) =>
                        j.status === "completed" || j.status === "failed"
                );
                if (allDone && !allDoneNotified.current) {
                    allDoneNotified.current = true;
                    setIsGenerating(false);
                    refreshCredits();
                    addGenerationNotification("creative_hub", next.length);
                    if (
                        typeof window !== "undefined" &&
                        "Notification" in window &&
                        Notification.permission === "granted"
                    ) {
                        const successes = next.filter(
                            (j) => j.status === "completed"
                        ).length;
                        new Notification("היצירות הושלמו!", {
                            body: `${successes} מתוך ${next.length} סוגי תוכן מוכנים`,
                            icon: "/favicon.ico",
                        });
                    }
                    sessionStorage.removeItem(STORAGE_KEY);
                    setGlobalStatus(
                        `הכל הושלם! ${next.filter((j) => j.status === "completed").length} מתוך ${next.length} הצליחו`
                    );
                }
                return next;
            });
        }, 3000);

        return () => clearTimeout(t);
    }, [jobStates, pollJob, refreshCredits, addGenerationNotification]);

    useEffect(() => {
        try {
            const stored = sessionStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as Record<string, string>;
                const ids = Object.entries(parsed).map(([type, id]) => ({
                    id,
                    type: type as JobState["type"],
                    status: "processing" as JobStatus,
                    statusText: "ממשיך מעיבוד קודם...",
                }));
                if (ids.length > 0) {
                    setJobStates(ids);
                    setIsGenerating(true);
                    allDoneNotified.current = false;
                    completedJobsRef.current = new Set();
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
        completedJobsRef.current = new Set();
        setJobStates([]);
        setGlobalStatus("שולח בקשה...");

        try {
            if (mediaType === "url" && websiteUrl.trim()) {
                setGlobalStatus("מחלץ מידע מהאתר שלך...");
            }

            let imageBase64: string | undefined;
            let imageMimeType: string | undefined;
            if (mediaType === "image" && imageFile) {
                setGlobalStatus("מעבד תמונה...");
                imageBase64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const result = reader.result as string;
                        const base64 = result.includes(",")
                            ? result.split(",")[1]!
                            : result;
                        resolve(base64);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(imageFile);
                });
                imageMimeType = imageFile.type || "image/png";
            }

            setGlobalStatus("מאתחל יצירות...");

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
            const jobs: JobState[] = Object.entries(jobIds).map(
                ([type, id]) => ({
                    id,
                    type: type as JobState["type"],
                    status: "processing" as const,
                    progress: 5,
                    statusText: "מתחיל עיבוד...",
                })
            );

            setJobStates(jobs);
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(jobIds));
            setGlobalStatus(
                `מעבד ${jobs.length} סוגי תוכן במקביל...`
            );
            toast.success(
                `${jobs.length} יצירות החלו! ניתן לסגור את הדף.`
            );
        } catch (err: any) {
            toast.error(err.message);
            setIsGenerating(false);
            setGlobalStatus("");
        }
    };

    const toggleOption = (key: keyof typeof options) => {
        setOptions((o) => ({ ...o, [key]: !o[key] }));
    };

    const completedCount = jobStates.filter(
        (j) => j.status === "completed"
    ).length;
    const failedCount = jobStates.filter(
        (j) => j.status === "failed"
    ).length;

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
                    {/* Controls */}
                    <div className="lg:col-span-3 space-y-4">
                        <Card className="shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base sm:text-lg">
                                    תיאור ומדיה
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium">
                                        תיאור (חובה)
                                    </Label>
                                    <Textarea
                                        placeholder="לדוגמה: קפה איכותי בשקיעה עם נוף לים..."
                                        value={prompt}
                                        onChange={(e) =>
                                            setPrompt(e.target.value)
                                        }
                                        rows={4}
                                        disabled={isGenerating}
                                        className="min-h-[100px] text-base resize-none"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium">
                                        תמונה שלך / קישור (אופציונלי)
                                    </Label>
                                    <p className="text-xs text-gray-400">
                                        העלה תמונה שלך כדי שהדמות תופיע בכל התוכן שייווצר
                                    </p>
                                    <div className="flex gap-2">
                                        {(
                                            ["none", "image", "url"] as const
                                        ).map((t) => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() =>
                                                    setMediaType(t)
                                                }
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
                                                        <span className="hidden sm:inline">
                                                            תמונה
                                                        </span>
                                                    </>
                                                )}
                                                {t === "url" && (
                                                    <>
                                                        <Link2 className="h-4 w-4" />
                                                        <span className="hidden sm:inline">
                                                            קישור
                                                        </span>
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
                                                    <span className="text-gray-400 text-sm">
                                                        לחץ להעלאת תמונה שלך (פנים ברורות)
                                                    </span>
                                                )}
                                            </label>
                                        </div>
                                    )}
                                    {mediaType === "url" && (
                                        <Input
                                            placeholder="https://example.com/article"
                                            value={websiteUrl}
                                            onChange={(e) =>
                                                setWebsiteUrl(e.target.value)
                                            }
                                            disabled={isGenerating}
                                            className="min-h-[48px] text-base mt-2"
                                        />
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium">
                                        סוגי תוכן
                                    </Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(
                                            [
                                                "story",
                                                "carousel",
                                                "video",
                                                "image",
                                            ] as const
                                        ).map((k) => {
                                            const Icon = TYPE_ICONS[k];
                                            return (
                                                <button
                                                    key={k}
                                                    type="button"
                                                    onClick={() =>
                                                        toggleOption(k)
                                                    }
                                                    disabled={isGenerating}
                                                    className={`flex items-center gap-2.5 p-3 rounded-xl border-2 min-h-[52px] text-right transition-all duration-200 cursor-pointer ${
                                                        options[k]
                                                            ? "border-purple-400 bg-purple-50 text-purple-700"
                                                            : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                                                    }`}
                                                >
                                                    <Icon className="h-5 w-5 flex-shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <span className="font-medium text-sm">
                                                            {TYPE_LABELS[k]}
                                                        </span>
                                                    </div>
                                                    <span className="text-[11px] text-gray-400 flex-shrink-0">
                                                        {TYPE_COSTS[k]}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Character image hint */}
                                {selectedCount > 0 && mediaType !== "image" && !imageFile && (options.story || options.video || options.image) && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-700 flex items-start gap-2">
                                        <ImageIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                        <span>
                                            רוצה שהדמות שלך תופיע בתוכן? העלה תמונה שלך למעלה כדי שהמערכת תשמור על המראה שלך בכל היצירות.
                                        </span>
                                    </div>
                                )}

                                {/* Sticky generate button */}
                                <div className="sticky bottom-20 lg:static lg:bottom-auto bg-white pt-3 pb-2 lg:pb-0 z-10 space-y-2 border-t border-gray-100 lg:border-0">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-500">
                                            {selectedCount > 0
                                                ? `${selectedCount} סוגים נבחרו`
                                                : "בחר סוגי תוכן"}
                                        </span>
                                        <span className="font-semibold text-gray-700">
                                            {totalCost > 0 &&
                                                `${totalCost} קרדיטים`}
                                            {!creditsLoading &&
                                                totalCost > 0 && (
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
                                                {totalCost > 0
                                                    ? `צור (${totalCost} קרדיטים)`
                                                    : "צור"}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Steps info per selected type */}
                        {selectedCount > 0 && !isGenerating && (
                            <Card className="shadow-sm border-purple-100">
                                <CardContent className="pt-4 pb-3">
                                    <p className="text-xs font-medium text-purple-600 mb-2 flex items-center gap-1.5">
                                        <FileText className="h-3.5 w-3.5" />
                                        מה יקרה כשתלחץ &quot;צור&quot;
                                    </p>
                                    <div className="space-y-2">
                                        {(
                                            Object.entries(options) as [
                                                string,
                                                boolean,
                                            ][]
                                        )
                                            .filter(([, v]) => v)
                                            .map(([k]) => (
                                                <div
                                                    key={k}
                                                    className="flex items-start gap-2"
                                                >
                                                    <Wand2 className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                                                    <div>
                                                        <span className="text-xs font-medium text-gray-700">
                                                            {TYPE_LABELS[k]}:
                                                        </span>{" "}
                                                        <span className="text-xs text-gray-500">
                                                            {(
                                                                STEPS_INFO[
                                                                    k
                                                                ] || []
                                                            ).join(" → ")}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Results panel */}
                    <div className="lg:col-span-2 space-y-4">
                        <Card className="min-h-[300px] sm:min-h-[400px] shadow-sm">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base sm:text-lg">
                                        תוצאות
                                    </CardTitle>
                                    {jobStates.length > 0 && (
                                        <span className="text-xs text-gray-400">
                                            {completedCount}/{jobStates.length}
                                        </span>
                                    )}
                                </div>
                                {isGenerating && globalStatus && (
                                    <p className="text-xs text-purple-600 animate-pulse mt-1 flex items-center gap-1.5">
                                        <Globe className="h-3 w-3" />
                                        {globalStatus}
                                    </p>
                                )}
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {jobStates.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                        <Sparkles className="h-12 w-12 mb-3 opacity-20" />
                                        <p className="text-sm">
                                            התוצאות יופיעו כאן
                                        </p>
                                        <p className="text-xs mt-1 text-gray-300">
                                            ניתן לסגור את הדף - היצירה תמשיך
                                            ברקע
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {jobStates.map((job) => {
                                            const storyImages = jobStates.find(
                                                (j) => j.type === "story" && j.status === "completed" && j.result?.imageUrls?.length
                                            )?.result?.imageUrls || [];
                                            return (
                                                <JobCard
                                                    key={job.id}
                                                    job={job}
                                                    storyImages={storyImages}
                                                    onRegenerateCarousel={async (bgUrl: string) => {
                                                        if (!job.result?.slides) return;
                                                        toast.info("מייצר קרוסלה מחדש עם תמונה חדשה...");
                                                        try {
                                                            const imgRes = await fetch(bgUrl);
                                                            const imgBuf = await imgRes.arrayBuffer();
                                                            const base64 = btoa(
                                                                new Uint8Array(imgBuf).reduce((s, b) => s + String.fromCharCode(b), "")
                                                            );
                                                            const res = await fetch("/api/generate/carousel-regen", {
                                                                method: "POST",
                                                                headers: { "Content-Type": "application/json" },
                                                                body: JSON.stringify({
                                                                    jobId: job.id,
                                                                    slides: job.result.slides,
                                                                    templateId: job.result.template || "b1",
                                                                    customBackgroundBase64: base64,
                                                                }),
                                                            });
                                                            const data = await res.json();
                                                            if (!res.ok) throw new Error(data.error || "שגיאה");
                                                            setJobStates((prev) =>
                                                                prev.map((j) =>
                                                                    j.id === job.id
                                                                        ? { ...j, result: { ...j.result, images: data.images } }
                                                                        : j
                                                                )
                                                            );
                                                            toast.success("קרוסלה עודכנה בהצלחה!");
                                                        } catch (err: any) {
                                                            toast.error(err.message || "שגיאה בעדכון הקרוסלה");
                                                        }
                                                    }}
                                                />
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

function JobCard({
    job,
    storyImages = [],
    onRegenerateCarousel,
}: {
    job: JobState;
    storyImages?: string[];
    onRegenerateCarousel?: (bgUrl: string) => void;
}) {
    const [showBgPicker, setShowBgPicker] = useState(false);
    const Icon = TYPE_ICONS[job.type] || Sparkles;
    const isProcessing =
        job.status === "processing" || job.status === "pending";
    const isCompleted = job.status === "completed";
    const isFailed = job.status === "failed";

    return (
        <div
            className={`p-3 sm:p-4 rounded-xl border transition-all duration-300 ${
                isCompleted
                    ? "border-emerald-200 bg-emerald-50/50"
                    : isFailed
                      ? "border-red-200 bg-red-50/50"
                      : "border-gray-200 bg-white"
            }`}
        >
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
                <div
                    className={`p-1.5 rounded-lg ${
                        isCompleted
                            ? "bg-emerald-100"
                            : isFailed
                              ? "bg-red-100"
                              : "bg-purple-100"
                    }`}
                >
                    <Icon
                        className={`h-4 w-4 ${
                            isCompleted
                                ? "text-emerald-600"
                                : isFailed
                                  ? "text-red-600"
                                  : "text-purple-600"
                        }`}
                    />
                </div>
                <span className="font-medium text-sm flex-1">
                    {TYPE_LABELS[job.type]}
                </span>
                {isProcessing && (
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {job.progress ?? 0}%
                    </span>
                )}
                {isCompleted && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                )}
                {isFailed && <XCircle className="h-4 w-4 text-red-500" />}
            </div>

            {/* Status text */}
            {isProcessing && job.statusText && (
                <p className="text-xs text-purple-600 mb-2 animate-pulse">
                    {job.statusText}
                </p>
            )}

            {/* Progress bar */}
            {isProcessing && (
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-700 rounded-full"
                        style={{ width: `${job.progress ?? 0}%` }}
                    />
                </div>
            )}

            {/* Completed results */}
            {isCompleted && job.result && (
                <div className="mt-2 space-y-2">
                    {/* Video result */}
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

                    {/* Image result */}
                    {job.type === "image" &&
                        (job.result.url || job.result.imageUrl) && (
                            <div>
                                <img
                                    src={
                                        job.result.url || job.result.imageUrl
                                    }
                                    alt="תוצאה"
                                    className="w-full rounded-lg object-contain max-h-48"
                                    loading="lazy"
                                />
                                <a
                                    href={
                                        job.result.url || job.result.imageUrl
                                    }
                                    download
                                    className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 mt-1.5 cursor-pointer transition-colors"
                                >
                                    <Download className="h-3.5 w-3.5" /> הורד
                                </a>
                            </div>
                        )}

                    {/* Story result */}
                    {job.type === "story" &&
                        (job.result.imageUrls || job.result.videoUrl) && (
                            <div className="space-y-2">
                                {/* Story images */}
                                {job.result.imageUrls?.length > 0 && (
                                    <>
                                        <p className="text-xs text-gray-500 font-medium">תמונות סטורי:</p>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {(job.result.imageUrls || []).map(
                                                (url: string, i: number) => (
                                                    <div key={i} className="relative group">
                                                        <img
                                                            src={url}
                                                            alt={`סטורי ${i + 1}`}
                                                            className="w-full aspect-[9/16] rounded-lg object-cover"
                                                            loading="lazy"
                                                        />
                                                        <a
                                                            href={url}
                                                            download={`story_${i + 1}.png`}
                                                            className="absolute bottom-1 right-1 bg-black/60 text-white rounded-md p-1.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                                        >
                                                            <Download className="h-3.5 w-3.5" />
                                                        </a>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {(job.result.imageUrls || []).map(
                                                (url: string, i: number) => (
                                                    <a
                                                        key={i}
                                                        href={url}
                                                        download={`story_${i + 1}.png`}
                                                        className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 cursor-pointer transition-colors bg-purple-50 px-2 py-1 rounded-md"
                                                    >
                                                        <Download className="h-3 w-3" /> {i + 1}
                                                    </a>
                                                )
                                            )}
                                            <button
                                                onClick={() => {
                                                    (job.result.imageUrls || []).forEach((url: string, i: number) => {
                                                        const a = document.createElement("a");
                                                        a.href = url;
                                                        a.download = `story_${i + 1}.png`;
                                                        a.click();
                                                    });
                                                }}
                                                className="inline-flex items-center gap-1 text-xs text-white bg-purple-600 hover:bg-purple-700 cursor-pointer transition-colors px-2 py-1 rounded-md"
                                            >
                                                <Download className="h-3 w-3" /> הורד הכל
                                            </button>
                                        </div>
                                    </>
                                )}

                                {/* Story video */}
                                {job.result.videoUrl && (
                                    <>
                                        <p className="text-xs text-gray-500 font-medium mt-2">וידאו סטורי:</p>
                                        <video
                                            src={job.result.videoUrl}
                                            controls
                                            className="w-full rounded-lg"
                                            playsInline
                                        />
                                        <a
                                            href={job.result.videoUrl}
                                            download="story_video.mp4"
                                            className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 cursor-pointer transition-colors"
                                        >
                                            <Download className="h-3.5 w-3.5" /> הורד וידאו
                                        </a>
                                    </>
                                )}
                            </div>
                        )}

                    {/* Carousel result */}
                    {job.type === "carousel" && job.result.images && (
                        <div className="space-y-2">
                            <div className="flex gap-1.5 overflow-x-auto pb-1.5 -mx-1 px-1">
                                {job.result.images.map((url: string, i: number) => (
                                    <img
                                        key={i}
                                        src={url}
                                        alt={`שקופית ${i + 1}`}
                                        className="h-20 w-auto rounded-lg object-cover flex-shrink-0"
                                        loading="lazy"
                                    />
                                ))}
                            </div>
                            <button
                                onClick={async () => {
                                    const images = job.result.images as string[];
                                    for (let i = 0; i < images.length; i++) {
                                        try {
                                            const res = await fetch(images[i], { mode: "cors" });
                                            const blob = await res.blob();
                                            const u = URL.createObjectURL(blob);
                                            const a = document.createElement("a");
                                            a.href = u;
                                            a.download = `carousel_${i + 1}.png`;
                                            a.click();
                                            URL.revokeObjectURL(u);
                                            if (i < images.length - 1) await new Promise((r) => setTimeout(r, 150));
                                        } catch {
                                            const a = document.createElement("a");
                                            a.href = images[i];
                                            a.download = `carousel_${i + 1}.png`;
                                            a.target = "_blank";
                                            a.click();
                                        }
                                    }
                                    toast.success(`הורדת ${images.length} שקופיות`);
                                }}
                                className="inline-flex items-center gap-1 text-xs text-white bg-purple-600 hover:bg-purple-700 cursor-pointer transition-colors px-3 py-1.5 rounded-md"
                            >
                                <Download className="h-3.5 w-3.5" /> הורד את כל הקרוסלה
                            </button>

                            {/* Swap background with story image */}
                            {storyImages.length > 0 && onRegenerateCarousel && (
                                <div className="mt-2 border-t border-gray-100 pt-2">
                                    <button
                                        onClick={() => setShowBgPicker(!showBgPicker)}
                                        className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 cursor-pointer transition-colors font-medium"
                                    >
                                        <RefreshCw className="h-3.5 w-3.5" />
                                        {showBgPicker ? "הסתר" : "החלף רקע עם תמונת סטורי"}
                                    </button>
                                    {showBgPicker && (
                                        <div className="mt-2 space-y-1.5">
                                            <p className="text-[11px] text-gray-400">בחר תמונה מהסטוריז כרקע חדש:</p>
                                            <div className="flex gap-1.5 overflow-x-auto pb-1">
                                                {storyImages.map((url: string, i: number) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => {
                                                            setShowBgPicker(false);
                                                            onRegenerateCarousel(url);
                                                        }}
                                                        className="flex-shrink-0 rounded-lg overflow-hidden border-2 border-transparent hover:border-indigo-400 transition-colors cursor-pointer"
                                                    >
                                                        <img
                                                            src={url}
                                                            alt={`סטורי ${i + 1}`}
                                                            className="h-16 w-auto object-cover"
                                                        />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Error message */}
            {isFailed && job.error && (
                <p className="text-xs text-red-500 mt-1">{job.error}</p>
            )}
        </div>
    );
}
