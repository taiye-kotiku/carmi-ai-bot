"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, Download, Sparkles, Video } from "lucide-react";
import { useNotifications } from "@/lib/notifications/notification-context";

export default function TextToVideoPage() {
    const [prompt, setPrompt] = useState("");
    const [duration, setDuration] = useState<4 | 8>(8);
    const [aspectRatio, setAspectRatio] = useState("16:9");
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState("");
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const pollRef = useRef<NodeJS.Timeout | null>(null);

    const { addGenerationNotification } = useNotifications();

    const stopPolling = useCallback(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }, []);

    const pollJob = useCallback(
        (jobId: string) => {
            pollRef.current = setInterval(async () => {
                try {
                    const res = await fetch(`/api/jobs/${jobId}`);
                    const data = await res.json();

                    if (data.progress) {
                        setProgress(data.progress);
                    }

                    if (data.status === "completed") {
                        stopPolling();
                        const videoUrl = data.result?.videoUrl;
                        if (videoUrl) {
                            setResult(videoUrl);
                            setProgress(100);
                            setStatusText("הסרטון מוכן!");
                            addGenerationNotification("video");
                        } else {
                            setError("לא התקבל קישור לוידאו");
                        }
                        setIsGenerating(false);
                    } else if (data.status === "failed") {
                        stopPolling();
                        setError(data.error || "יצירת הסרטון נכשלה");
                        setIsGenerating(false);
                        setProgress(0);
                    } else {
                        // Still processing
                        if (data.progress < 30) {
                            setStatusText("מתחיל ליצור סרטון...");
                        } else if (data.progress < 60) {
                            setStatusText("הסרטון בעיבוד...");
                        } else if (data.progress < 80) {
                            setStatusText("כמעט מוכן...");
                        } else {
                            setStatusText("מוריד ושומר...");
                        }
                    }
                } catch (err) {
                    console.error("Poll error:", err);
                }
            }, 3000);
        },
        [stopPolling, addGenerationNotification]
    );

    const handleGenerate = async () => {
        if (!prompt.trim()) return;

        setIsGenerating(true);
        setProgress(5);
        setError(null);
        setResult(null);
        setStatusText("שולח בקשה...");

        try {
            const response = await fetch("/api/generate/text-to-video", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt, duration, aspectRatio }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "שגיאה ביצירת הסרטון");
            }

            if (data.jobId) {
                setProgress(10);
                setStatusText("הסרטון בתהליך יצירה...");
                pollJob(data.jobId);
            } else {
                throw new Error("לא התקבל מזהה עבודה");
            }
        } catch (err: any) {
            console.error("Generate error:", err);
            setError(err.message);
            setIsGenerating(false);
        }
    };

    const handleDownload = async () => {
        if (!result) return;

        try {
            const response = await fetch(result);
            const blob = await response.blob();
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = `video-${Date.now()}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);
        } catch (err) {
            window.open(result, "_blank");
        }
    };

    return (
        <div className="container mx-auto py-8 px-4" dir="rtl">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                        <Video className="h-8 w-8 text-blue-500" />
                        יצירת סרטון מטקסט
                    </h1>
                    <p className="text-gray-600">
                        תאר את הסרטון שברצונך ליצור ו-AI ייצור אותו עבורך
                    </p>
                </div>

                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>תיאור הסרטון</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Textarea
                            placeholder="תאר את הסרטון שברצונך ליצור... לדוגמה: גלים שוברים על חוף סלעי בשקיעה, מבט מלמעלה"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            rows={4}
                            className="text-right"
                            disabled={isGenerating}
                        />

                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                משך הסרטון
                            </label>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setDuration(4)}
                                    disabled={isGenerating}
                                    className={`flex-1 py-3 rounded-lg border-2 font-medium transition-all ${duration === 4
                                            ? "bg-blue-500 border-blue-500 text-white"
                                            : "bg-white border-gray-300 text-gray-700 hover:border-blue-300"
                                        }`}
                                >
                                    4 שניות
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDuration(8)}
                                    disabled={isGenerating}
                                    className={`flex-1 py-3 rounded-lg border-2 font-medium transition-all ${duration === 8
                                            ? "bg-blue-500 border-blue-500 text-white"
                                            : "bg-white border-gray-300 text-gray-700 hover:border-blue-300"
                                        }`}
                                >
                                    8 שניות
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                יחס תצוגה
                            </label>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setAspectRatio("16:9")}
                                    disabled={isGenerating}
                                    className={`flex-1 py-3 rounded-lg border-2 font-medium transition-all ${aspectRatio === "16:9"
                                            ? "bg-blue-500 border-blue-500 text-white"
                                            : "bg-white border-gray-300 text-gray-700 hover:border-blue-300"
                                        }`}
                                >
                                    16:9 (רוחבי)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAspectRatio("9:16")}
                                    disabled={isGenerating}
                                    className={`flex-1 py-3 rounded-lg border-2 font-medium transition-all ${aspectRatio === "9:16"
                                            ? "bg-blue-500 border-blue-500 text-white"
                                            : "bg-white border-gray-300 text-gray-700 hover:border-blue-300"
                                        }`}
                                >
                                    9:16 (אנכי)
                                </button>
                            </div>
                        </div>

                        <div className="bg-yellow-50 p-3 rounded-lg text-sm text-yellow-700">
                            💡 יצירת סרטון עולה 25 קרדיטים ואורכת כ-2-3 דקות
                        </div>

                        <Button
                            onClick={handleGenerate}
                            disabled={!prompt.trim() || isGenerating}
                            className="w-full"
                            size="lg"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                                    יוצר סרטון...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="ml-2 h-5 w-5" />
                                    צור סרטון (25 קרדיטים)
                                </>
                            )}
                        </Button>

                        {isGenerating && (
                            <div className="space-y-2">
                                <Progress value={progress} />
                                <p className="text-sm text-center text-gray-500">
                                    {progress}% הושלם - {statusText}
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

                {result && (
                    <Card>
                        <CardHeader>
                            <CardTitle>הסרטון שלך מוכן! 🎬</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <video
                                src={result}
                                controls
                                className="w-full rounded-lg shadow-lg"
                                autoPlay
                                loop
                            />
                            <Button
                                onClick={handleDownload}
                                variant="secondary"
                                className="w-full"
                            >
                                <Download className="ml-2 h-5 w-5" />
                                הורד סרטון
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}