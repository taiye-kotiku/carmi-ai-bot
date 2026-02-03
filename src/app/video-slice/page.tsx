"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, Scissors, Download, Video } from "lucide-react";

const VIDEO_TYPES = [
    { value: 1, label: "קישור ישיר (MP4)" },
    { value: 2, label: "YouTube" },
    { value: 3, label: "Google Drive" },
    { value: 4, label: "Vimeo" },
    { value: 6, label: "TikTok" },
    { value: 7, label: "Twitter" },
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

interface Clip {
    id: string;
    title: string;
    duration: number;
    downloadUrl: string;
    thumbnailUrl?: string;
}

export default function VideoSlicePage() {
    const [videoUrl, setVideoUrl] = useState("");
    const [videoType, setVideoType] = useState(2); // Default YouTube
    const [preferLength, setPreferLength] = useState([0]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [projectId, setProjectId] = useState<string | null>(null);
    const [clips, setClips] = useState<Clip[]>([]);
    const [error, setError] = useState<string | null>(null);

    const handleSlice = async () => {
        if (!videoUrl.trim()) return;

        setIsProcessing(true);
        setProgress(0);
        setError(null);
        setClips([]);
        setProjectId(null);

        try {
            // Create project
            const response = await fetch("/api/vizard/slice", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    videoUrl,
                    videoType,
                    preferLength,
                    language: "auto",
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "שגיאה ביצירת הפרויקט");
            }

            setProjectId(data.projectId);

            // Poll for status
            await pollForClips(data.projectId);
        } catch (err: any) {
            setError(err.message);
            setIsProcessing(false);
        }
    };

    const pollForClips = async (projectId: string) => {
        const maxAttempts = 120; // 10 minutes max

        for (let i = 0; i < maxAttempts; i++) {
            await new Promise((resolve) => setTimeout(resolve, 5000));

            try {
                const response = await fetch(`/api/vizard/status?projectId=${projectId}`);
                const data = await response.json();

                if (data.progress) {
                    setProgress(data.progress);
                } else {
                    setProgress(Math.min(90, (i / maxAttempts) * 100));
                }

                if (data.status === "completed" && data.clips?.length > 0) {
                    setClips(data.clips);
                    setProgress(100);
                    setIsProcessing(false);
                    return;
                }

                if (data.status === "failed") {
                    throw new Error("עיבוד הוידאו נכשל");
                }
            } catch (err: any) {
                console.error("Poll error:", err);
            }
        }

        throw new Error("עיבוד הוידאו לקח יותר מדי זמן");
    };

    const toggleLength = (value: number) => {
        if (value === 0) {
            setPreferLength([0]);
        } else {
            const newLengths = preferLength.includes(0)
                ? [value]
                : preferLength.includes(value)
                    ? preferLength.filter((v) => v !== value)
                    : [...preferLength, value];
            setPreferLength(newLengths.length ? newLengths : [0]);
        }
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
                        הכנס קישור לוידאו ארוך ו-AI יחתוך אותו לקליפים קצרים וויראליים
                    </p>
                </div>

                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>הגדרות חיתוך</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Video URL */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium">קישור לוידאו</label>
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
                            <label className="block text-sm font-medium">סוג הקישור</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {VIDEO_TYPES.map((type) => (
                                    <button
                                        key={type.value}
                                        type="button"
                                        onClick={() => setVideoType(type.value)}
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

                        {/* Clip Length */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium">אורך הקליפים</label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {CLIP_LENGTHS.map((length) => (
                                    <button
                                        key={length.value}
                                        type="button"
                                        onClick={() => toggleLength(length.value)}
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
                            💡 חיתוך וידאו עולה 5 קרדיטים ואורך כ-5-10 דקות בהתאם לאורך הוידאו
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
                                    התחל חיתוך (5 קרדיטים)
                                </>
                            )}
                        </Button>

                        {isProcessing && (
                            <div className="space-y-2">
                                <Progress value={progress} />
                                <p className="text-sm text-center text-gray-500">
                                    {Math.round(progress)}% הושלם - חיתוך וידאו לוקח זמן, אנא המתן
                                </p>
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
                        )}
                    </CardContent>
                </Card>

                {/* Clips Results */}
                {clips.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>הקליפים שלך מוכנים! ({clips.length} קליפים)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid md:grid-cols-2 gap-4">
                                {clips.map((clip, index) => (
                                    <div
                                        key={clip.id || index}
                                        className="border rounded-lg overflow-hidden"
                                    >
                                        {clip.thumbnailUrl && (
                                            <img
                                                src={clip.thumbnailUrl}
                                                alt={clip.title}
                                                className="w-full h-40 object-cover"
                                            />
                                        )}
                                        <div className="p-3 space-y-2">
                                            <h3 className="font-medium line-clamp-2">
                                                {clip.title || `קליפ ${index + 1}`}
                                            </h3>
                                            <p className="text-sm text-gray-500">
                                                {clip.duration} שניות
                                            </p>
                                            {clip.downloadUrl && (
                                                <a
                                                    href={clip.downloadUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700"
                                                >
                                                    <Download className="h-4 w-4" />
                                                    הורד קליפ
                                                </a>
                                            )}
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