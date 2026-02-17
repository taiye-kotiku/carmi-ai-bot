"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, Download, Sparkles, Video } from "lucide-react";
import { useNotifications } from "@/lib/notifications/notification-context";
import { CREDIT_COSTS } from "@/lib/config/credits";

export default function TextToVideoPage() {
    const [prompt, setPrompt] = useState("");
    const [duration, setDuration] = useState<4 | 8>(8);
    const [aspectRatio, setAspectRatio] = useState("16:9");
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const isCompletedRef = useRef(false);

    const { addGenerationNotification } = useNotifications();

    const handleGenerate = async () => {
        if (!prompt.trim()) return;

        setIsGenerating(true);
        setProgress(0);
        setError(null);
        setResult(null);

        const progressInterval = setInterval(() => {
            setProgress((prev) => Math.min(prev + 1, 95));
        }, 2000);

        try {
            const response = await fetch("/api/generate/text-to-video", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt, duration, aspectRatio }),
            });

            const text = await response.text();
            let data: { jobId?: string; videoUrl?: string; error?: string };
            try {
                data = text ? JSON.parse(text) : {};
            } catch (e) {
                console.error("Failed to parse response:", text);
                throw new Error("תגובה לא תקינה מהשרת");
            }

            if (!response.ok) {
                throw new Error(data.error || "שגיאה ביצירת הסרטון");
            }

            const jobId = data.jobId;
            if (!jobId) {
                throw new Error(data.error || "לא התקבל מזהה עבודה");
            }

            // Poll for job status (video generation takes 2-3 minutes)
            clearInterval(progressInterval);
            isCompletedRef.current = false;
            const pollInterval = setInterval(async () => {
                try {
                    const jobRes = await fetch(`/api/jobs/${jobId}`);
                    const job: { status?: string; progress?: number; result?: { videoUrl?: string; url?: string }; error?: string } = await jobRes.json();

                    setProgress(job.progress ?? 0);

                    if (job.status === "completed") {
                        if (isCompletedRef.current) return;
                        isCompletedRef.current = true;
                        clearInterval(pollInterval);
                        const videoUrl = job.result?.videoUrl || job.result?.url;
                        if (videoUrl) {
                            setProgress(100);
                            setResult(videoUrl);
                            addGenerationNotification("video");
                        } else {
                            setError("לא התקבל קישור לוידאו");
                        }
                        setIsGenerating(false);
                    } else if (job.status === "failed") {
                        if (isCompletedRef.current) return;
                        isCompletedRef.current = true;
                        clearInterval(pollInterval);
                        setError(job.error || "שגיאה ביצירת הסרטון");
                        setIsGenerating(false);
                    }
                } catch (pollErr) {
                    console.error("Poll error:", pollErr);
                }
            }, 3000);
        } catch (err: any) {
            console.error("Generate error:", err);
            setError(err.message);
            setIsGenerating(false);
        } finally {
            clearInterval(progressInterval);
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
                            💡 יצירת סרטון עולה {CREDIT_COSTS.video_generation} קרדיטים ואורכת כ-2-3 דקות
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
                                    צור סרטון ({CREDIT_COSTS.video_generation} קרדיטים)
                                </>
                            )}
                        </Button>

                        {isGenerating && (
                            <div className="space-y-2">
                                <Progress value={progress} />
                                <p className="text-sm text-center text-gray-500">
                                    {progress}% הושלם - יצירת סרטון לוקחת זמן, אנא המתן
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
                            <CardTitle>הסרטון שלך מוכן!</CardTitle>
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