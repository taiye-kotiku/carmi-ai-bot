"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, Download, Sparkles, Video } from "lucide-react";
import { useNotifications } from "@/lib/notifications/notification-context";

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 100; // ~5 minutes total

export default function TextToVideoPage() {
    const [prompt, setPrompt] = useState("");
    const [duration, setDuration] = useState<4 | 8>(8);
    const [aspectRatio, setAspectRatio] = useState("16:9");
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState("");
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const { addGenerationNotification } = useNotifications();

    // Polls /api/jobs/[id] until the job is done, then returns the video URL
    const pollJob = async (jobId: string): Promise<string> => {
        for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
            await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS));

            const res = await fetch(`/api/jobs/${jobId}`);
            const job = await res.json();

            if (!res.ok) throw new Error(job.error || "שגיאה בבדיקת סטטוס");

            setProgress(job.progress ?? 0);

            if (job.status === "completed") {
                const videoUrl = job.result?.videoUrl;
                if (!videoUrl) throw new Error("הסרטון הושלם אך לא התקבל קישור");
                return videoUrl;
            }

            if (job.status === "failed") {
                throw new Error(job.error || "יצירת הסרטון נכשלה");
            }

            // Still processing
            const elapsed = Math.floor(((attempt + 1) * POLL_INTERVAL_MS) / 1000);
            setStatusText(`מעבד... ${elapsed} שניות`);
        }

        throw new Error("יצירת הסרטון לקחה יותר מדי זמן");
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) return;

        setIsGenerating(true);
        setProgress(5);
        setStatusText("שולח בקשה...");
        setError(null);
        setResult(null);

        try {
            // Step 1: Kick off the job
            const response = await fetch("/api/generate/text-to-video", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt, duration, aspectRatio }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "שגיאה ביצירת הסרטון");
            }

            const { jobId } = data;
            if (!jobId) throw new Error("לא התקבל מזהה עבודה מהשרת");

            setProgress(10);
            setStatusText("יצירת הסרטון החלה, ממתין לתוצאות...");

            // Step 2: Poll until done
            const videoUrl = await pollJob(jobId);

            setProgress(100);
            setStatusText("הסרטון מוכן!");
            setResult(videoUrl);
            addGenerationNotification("video");
        } catch (err: any) {
            console.error("Generate error:", err);
            setError(err.message);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = async () => {
        if (!result) return;
        try {
            const response = await fetch(result);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `video-${Date.now()}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
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

                        {/* Duration selector */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                משך הסרטון
                            </label>
                            <div className="flex gap-3">
                                {([4, 8] as const).map((d) => (
                                    <button
                                        key={d}
                                        type="button"
                                        onClick={() => setDuration(d)}
                                        disabled={isGenerating}
                                        className={`flex-1 py-3 rounded-lg border-2 font-medium transition-all ${duration === d
                                                ? "bg-blue-500 border-blue-500 text-white"
                                                : "bg-white border-gray-300 text-gray-700 hover:border-blue-300"
                                            }`}
                                    >
                                        {d} שניות
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Aspect ratio selector */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                יחס תצוגה
                            </label>
                            <div className="flex gap-3">
                                {[
                                    { value: "16:9", label: "16:9 (רוחבי)" },
                                    { value: "9:16", label: "9:16 (אנכי)" },
                                ].map(({ value, label }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setAspectRatio(value)}
                                        disabled={isGenerating}
                                        className={`flex-1 py-3 rounded-lg border-2 font-medium transition-all ${aspectRatio === value
                                                ? "bg-blue-500 border-blue-500 text-white"
                                                : "bg-white border-gray-300 text-gray-700 hover:border-blue-300"
                                            }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-yellow-50 p-3 rounded-lg text-sm text-yellow-700">
                            💡 יצירת סרטון עולה 3 קרדיטים ואורכת כ-2-3 דקות
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
                                    צור סרטון (3 קרדיטים)
                                </>
                            )}
                        </Button>

                        {isGenerating && (
                            <div className="space-y-2">
                                <Progress value={progress} />
                                <p className="text-sm text-center text-gray-500">
                                    {statusText || `${progress}% הושלם`}
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