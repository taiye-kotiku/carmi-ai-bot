// src/app/(dashboard)/video-slice/page.tsx

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
    Loader2,
    Scissors,
    Download,
    ExternalLink,
    Star,
    ChevronDown,
    ChevronUp,
    Smile,
} from "lucide-react";

const VIDEO_TYPES = [
    { value: 2, label: "YouTube" },
    { value: 1, label: "קישור ישיר (MP4)" },
    { value: 3, label: "Google Drive" },
    { value: 4, label: "Vimeo" },
    { value: 6, label: "TikTok" },
    { value: 7, label: "Twitter / X" },
    { value: 11, label: "Facebook" },
    { value: 12, label: "LinkedIn" },
];

// No "under 30 seconds" — removed value 1
const CLIP_LENGTHS = [
    { value: 0, label: "אוטומטי (AI בוחר)" },
    { value: 2, label: "30-60 שניות" },
    { value: 3, label: "60-90 שניות" },
    { value: 4, label: "90 שניות - 3 דקות" },
];

const ASPECT_RATIOS = [
    { value: "9:16", label: "9:16 (TikTok, Reels)" },
    { value: "1:1", label: "1:1 (Instagram Feed)" },
    { value: "4:5", label: "4:5 (Instagram Portrait)" },
    { value: "16:9", label: "16:9 (YouTube, LinkedIn)" },
];

const LANGUAGES = [
    { value: "auto", label: "זיהוי אוטומטי" },
    { value: "he", label: "עברית" },
    { value: "en", label: "אנגלית" },
    { value: "ar", label: "ערבית" },
    { value: "es", label: "ספרדית" },
    { value: "fr", label: "צרפתית" },
    { value: "de", label: "גרמנית" },
    { value: "pt", label: "פורטוגזית" },
    { value: "ru", label: "רוסית" },
    { value: "it", label: "איטלקית" },
    { value: "ja", label: "יפנית" },
    { value: "ko", label: "קוריאנית" },
    { value: "zh", label: "סינית" },
    { value: "hi", label: "הינדית" },
    { value: "tr", label: "טורקית" },
];

interface Clip {
    id: number;
    title: string;
    duration: number;
    downloadUrl: string;
    thumbnailUrl?: string;
    transcript?: string;
    viralScore?: string;
    viralReason?: string;
    editorUrl?: string;
}

export default function VideoSlicePage() {
    const [videoUrl, setVideoUrl] = useState("");
    const [videoType, setVideoType] = useState(2);
    const [preferLength, setPreferLength] = useState<number[]>([0]);
    const [aspectRatio, setAspectRatio] = useState("9:16");
    const [language, setLanguage] = useState("auto");
    const [emoji, setEmoji] = useState(false);
    const [keywords, setKeywords] = useState("");
    const [maxClips, setMaxClips] = useState<number | "">("");
    const [projectName, setProjectName] = useState("");
    const [showAdvanced, setShowAdvanced] = useState(false);

    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [projectId, setProjectId] = useState<number | null>(null);
    const [clips, setClips] = useState<Clip[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [shareLink, setShareLink] = useState<string | null>(null);

    const handleSlice = async () => {
        if (!videoUrl.trim()) return;

        setIsProcessing(true);
        setProgress(0);
        setError(null);
        setClips([]);
        setProjectId(null);
        setShareLink(null);

        try {
            const body: Record<string, any> = {
                videoUrl,
                videoType,
                preferLength,
                aspectRatio,
                language,
                emoji,
                // Fixed settings — always ON
                removeSilence: true,
                subtitles: true,
                highlight: true,
                autoBroll: true,
                headline: true,
            };

            if (keywords.trim()) {
                body.keywords = keywords.trim();
            }

            if (maxClips && maxClips > 0) {
                body.maxClips = maxClips;
            }

            if (projectName.trim()) {
                body.projectName = projectName.trim();
            }

            const response = await fetch("/api/vizard/slice", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || "שגיאה ביצירת הפרויקט");
            }

            setProjectId(data.projectId);
            if (data.shareLink) setShareLink(data.shareLink);

            setProgress(5);

            await pollForClips(data.projectId);
        } catch (err: any) {
            setError(err.message);
            setIsProcessing(false);
        }
    };

    const pollForClips = async (pid: number) => {
        const maxAttempts = 80;
        const pollInterval = 30000;

        for (let i = 0; i < maxAttempts; i++) {
            await new Promise((resolve) => setTimeout(resolve, pollInterval));

            try {
                const response = await fetch(
                    `/api/vizard/status?projectId=${pid}`
                );
                const data = await response.json();

                const estimatedProgress = Math.min(5 + (i + 1) * 2, 90);
                setProgress(estimatedProgress);

                if (data.status === "completed" && data.clips?.length > 0) {
                    setClips(data.clips);
                    if (data.shareLink) setShareLink(data.shareLink);
                    setProgress(100);
                    setIsProcessing(false);
                    return;
                }

                if (data.status === "error") {
                    throw new Error(data.error || "עיבוד הוידאו נכשל");
                }
            } catch (err: any) {
                if (
                    err.message.includes("נכשל") ||
                    err.message.includes("error")
                ) {
                    setError(err.message);
                    setIsProcessing(false);
                    return;
                }
                console.error("Poll error:", err);
            }
        }

        setError("עיבוד הוידאו לקח יותר מדי זמן. נסה שנית.");
        setIsProcessing(false);
    };

    const toggleLength = (value: number) => {
        if (value === 0) {
            setPreferLength([0]);
        } else {
            let newLengths: number[];
            if (preferLength.includes(0)) {
                newLengths = [value];
            } else if (preferLength.includes(value)) {
                newLengths = preferLength.filter((v) => v !== value);
            } else {
                newLengths = [...preferLength, value];
            }
            setPreferLength(newLengths.length > 0 ? newLengths : [0]);
        }
    };

    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins > 0) {
            return `${mins}:${secs.toString().padStart(2, "0")}`;
        }
        return `${secs} שניות`;
    };

    return (
        <div className="container mx-auto py-8 px-4" dir="rtl">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                        <Scissors className="h-8 w-8 text-purple-500" />
                        חיתוך וידאו לקליפים
                    </h1>
                    <p className="text-gray-600">
                        הכנס קישור לוידאו ארוך ו-AI יחתוך אותו לקליפים קצרים
                        וויראליים
                    </p>
                </div>

                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>הגדרות חיתוך</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        {/* Video URL */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium">
                                קישור לוידאו
                            </label>
                            <Input
                                placeholder="https://www.youtube.com/watch?v=..."
                                value={videoUrl}
                                onChange={(e) => setVideoUrl(e.target.value)}
                                disabled={isProcessing}
                                className="text-left"
                                dir="ltr"
                            />
                        </div>

                        {/* Video Type */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium">
                                סוג הקישור
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {VIDEO_TYPES.map((type) => (
                                    <button
                                        key={type.value}
                                        type="button"
                                        onClick={() =>
                                            setVideoType(type.value)
                                        }
                                        disabled={isProcessing}
                                        className={`py-2 px-3 rounded-lg border text-sm transition-all ${videoType === type.value
                                                ? "bg-purple-500 border-purple-500 text-white"
                                                : "bg-white border-gray-300 hover:border-purple-300"
                                            }`}
                                    >
                                        {type.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Language */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium">
                                שפת הדיבור בוידאו
                            </label>
                            <select
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                                disabled={isProcessing}
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                            >
                                {LANGUAGES.map((lang) => (
                                    <option key={lang.value} value={lang.value}>
                                        {lang.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Aspect Ratio */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium">
                                יחס מסך
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {ASPECT_RATIOS.map((ratio) => (
                                    <button
                                        key={ratio.value}
                                        type="button"
                                        onClick={() =>
                                            setAspectRatio(ratio.value)
                                        }
                                        disabled={isProcessing}
                                        className={`py-2 px-3 rounded-lg border text-sm transition-all ${aspectRatio === ratio.value
                                                ? "bg-purple-500 border-purple-500 text-white"
                                                : "bg-white border-gray-300 hover:border-purple-300"
                                            }`}
                                    >
                                        {ratio.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Clip Length */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium">
                                אורך הקליפים
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {CLIP_LENGTHS.map((length) => (
                                    <button
                                        key={length.value}
                                        type="button"
                                        onClick={() =>
                                            toggleLength(length.value)
                                        }
                                        disabled={isProcessing}
                                        className={`py-2 px-3 rounded-lg border text-sm transition-all ${preferLength.includes(length.value)
                                                ? "bg-purple-500 border-purple-500 text-white"
                                                : "bg-white border-gray-300 hover:border-purple-300"
                                            }`}
                                    >
                                        {length.label}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-gray-400">
                                ניתן לבחור מספר אורכים. &quot;אוטומטי&quot; לא
                                ניתן לשילוב עם אחרים.
                            </p>
                        </div>

                        {/* Emoji Toggle */}
                        <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                            <div className="flex items-center gap-2">
                                <Smile className="h-4 w-4 text-gray-500" />
                                <div>
                                    <p className="text-sm font-medium">
                                        אימוג׳י בכתוביות
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        הוספת אימוג׳י אוטומטית לכתוביות
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEmoji(!emoji)}
                                disabled={isProcessing}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${emoji ? "bg-purple-500" : "bg-gray-200"
                                    }`}
                            >
                                <span
                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${emoji
                                            ? "-translate-x-5"
                                            : "translate-x-0"
                                        }`}
                                />
                            </button>
                        </div>

                        {/* Advanced Options Toggle */}
                        <button
                            type="button"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700 transition-colors"
                        >
                            {showAdvanced ? (
                                <ChevronUp className="h-4 w-4" />
                            ) : (
                                <ChevronDown className="h-4 w-4" />
                            )}
                            הגדרות מתקדמות
                        </button>

                        {showAdvanced && (
                            <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                                {/* Keywords / Topic Filter */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium">
                                        חיפוש נושא ספציפי (אופציונלי)
                                    </label>
                                    <Input
                                        placeholder='לדוגמה: "הרגע שדיבר על בינה מלאכותית" או "הכעס של המאמן"'
                                        value={keywords}
                                        onChange={(e) =>
                                            setKeywords(e.target.value)
                                        }
                                        disabled={isProcessing}
                                    />
                                    <p className="text-xs text-gray-400">
                                        ה-AI יחתוך רק רגעים שקשורים לנושא
                                        שהזנת. השאר ריק לחיתוך כללי.
                                    </p>
                                </div>

                                {/* Max Clips */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium">
                                        מספר קליפים מקסימלי (אופציונלי)
                                    </label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={100}
                                        placeholder="ללא הגבלה"
                                        value={maxClips}
                                        onChange={(e) =>
                                            setMaxClips(
                                                e.target.value
                                                    ? parseInt(e.target.value)
                                                    : ""
                                            )
                                        }
                                        disabled={isProcessing}
                                        className="text-left"
                                        dir="ltr"
                                    />
                                    <p className="text-xs text-gray-400">
                                        1-100. הקליפים הטובים ביותר יוחזרו
                                        לפי ציון ויראליות. השאר ריק לכל
                                        הקליפים.
                                    </p>
                                </div>

                                {/* Project Name */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium">
                                        שם הפרויקט (אופציונלי)
                                    </label>
                                    <Input
                                        placeholder="שם מותאם אישית לפרויקט"
                                        value={projectName}
                                        onChange={(e) =>
                                            setProjectName(e.target.value)
                                        }
                                        disabled={isProcessing}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Fixed features info */}
                        <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700 space-y-1">
                            <p>
                                ✅ <strong>תמיד פעיל:</strong> כתוביות, הסרת
                                שתיקה, הדגשת מילים, B-Roll אוטומטי, כותרת
                                פתיחה
                            </p>
                            <p>
                                💡 חיתוך אורך כ-5-15 דקות בהתאם לאורך הוידאו
                            </p>
                        </div>

                        <Button
                            onClick={handleSlice}
                            disabled={!videoUrl.trim() || isProcessing}
                            className="w-full"
                            size="lg"
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                                    מעבד וידאו...
                                </>
                            ) : (
                                <>
                                    <Scissors className="ml-2 h-5 w-5" />
                                    התחל חיתוך
                                </>
                            )}
                        </Button>

                        {isProcessing && (
                            <div className="space-y-2">
                                <Progress value={progress} />
                                <p className="text-sm text-center text-gray-500">
                                    {Math.round(progress)}% — חיתוך וידאו
                                    לוקח זמן, אנא המתן
                                </p>
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-50 text-red-600 p-4 rounded-lg">
                                {error}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Clips Results */}
                {clips.length > 0 && (
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle>
                                    הקליפים שלך מוכנים! ({clips.length}{" "}
                                    קליפים)
                                </CardTitle>
                                {shareLink && (
                                    <a
                                        href={shareLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
                                    >
                                        <ExternalLink className="h-3 w-3" />
                                        פתח בעורך Vizard
                                    </a>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid md:grid-cols-2 gap-4">
                                {clips.map((clip, index) => (
                                    <div
                                        key={clip.id || index}
                                        className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                                    >
                                        <div className="p-4 space-y-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <h3 className="font-medium line-clamp-2 flex-1">
                                                    {clip.title ||
                                                        `קליפ ${index + 1}`}
                                                </h3>
                                                {clip.viralScore && (
                                                    <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded text-xs font-medium text-yellow-700 shrink-0">
                                                        <Star className="h-3 w-3" />
                                                        {clip.viralScore}
                                                        /10
                                                    </div>
                                                )}
                                            </div>

                                            <p className="text-sm text-gray-500">
                                                {formatDuration(clip.duration)}
                                            </p>

                                            {clip.viralReason && (
                                                <p className="text-xs text-gray-400 line-clamp-2">
                                                    {clip.viralReason}
                                                </p>
                                            )}

                                            {clip.transcript && (
                                                <p
                                                    className="text-xs text-gray-400 line-clamp-3 border-t pt-2"
                                                    dir="auto"
                                                >
                                                    {clip.transcript.substring(
                                                        0,
                                                        150
                                                    )}
                                                    {clip.transcript.length >
                                                        150 && "..."}
                                                </p>
                                            )}

                                            <div className="flex gap-3 pt-1">
                                                {clip.downloadUrl && (
                                                    <a
                                                        href={clip.downloadUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700 font-medium"
                                                    >
                                                        <Download className="h-4 w-4" />
                                                        הורד
                                                    </a>
                                                )}
                                                {clip.editorUrl && (
                                                    <a
                                                        href={clip.editorUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                                                    >
                                                        <ExternalLink className="h-4 w-4" />
                                                        ערוך
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}