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

const CLIP_LENGTHS = [
    { value: 0, label: "אוטומטי (AI בוחר)" },
    { value: 1, label: "עד 30 שניות" },
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
            // Create project
            const response = await fetch("/api/vizard/slice", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    videoUrl,
                    videoType,
                    preferLength,
                    aspectRatio,
                    language: "auto",
                    removeSilence: true,
                    subtitles: true,
                    highlight: true,
                    autoBroll: true,
                    headline: true,
                }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || "שגיאה ביצירת הפרויקט");
            }

            setProjectId(data.projectId);
            if (data.shareLink) setShareLink(data.shareLink);

            setProgress(5);

            // Poll for clips
            await pollForClips(data.projectId);
        } catch (err: any) {
            setError(err.message);
            setIsProcessing(false);
        }
    };

    const pollForClips = async (pid: number) => {
        const maxAttempts = 80; // ~40 minutes at 30s intervals
        const pollInterval = 30000;

        for (let i = 0; i < maxAttempts; i++) {
            await new Promise((resolve) => setTimeout(resolve, pollInterval));

            try {
                const response = await fetch(
                    `/api/vizard/status?projectId=${pid}`
                );
                const data = await response.json();

                // Update progress
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

                // status === "processing" → continue
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
            // Auto mode — cannot combine with others
            setPreferLength([0]);
        } else {
            let newLengths: number[];
            if (preferLength.includes(0)) {
                // Switching from auto to specific
                newLengths = [value];
            } else if (preferLength.includes(value)) {
                // Deselect
                newLengths = preferLength.filter((v) => v !== value);
            } else {
                // Add
                newLengths = [...preferLength, value];
            }
            // If nothing selected, fall back to auto
            setPreferLength(newLengths.length > 0 ? newLengths : [0]);
        }
    };

    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return mins > 0
            ? `${mins}:${secs.toString().padStart(2, "0")}`
            : `${secs} שניות`;
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
                    <CardContent className="space-y-4">
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
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
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
                        </div>

                        <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
                            💡 חיתוך וידאו אורך כ-5-15 דקות בהתאם לאורך הוידאו
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
                                    {Math.round(progress)}% — חיתוך וידאו לוקח
                                    זמן, אנא המתן
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
                            <CardTitle>
                                הקליפים שלך מוכנים! ({clips.length} קליפים)
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
                                                        {clip.viralScore}/10
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
                                                    ...
                                                </p>
                                            )}

                                            <div className="flex gap-2 pt-1">
                                                {clip.downloadUrl && (
                                                    <a
                                                        href={clip.downloadUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700"
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