"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, Download, Sparkles, Video } from "lucide-react";
import { useNotifications } from "@/lib/notifications/notification-context";

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 100;

export default function TextToVideoPage() {
    const [prompt, setPrompt] = useState("");
    const [duration, setDuration] = useState<4 | 8 | 15>(8);
    const [aspectRatio, setAspectRatio] = useState("16:9");
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState("");
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const { addGenerationNotification } = useNotifications();

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

    const durations = [
        { value: 4 as const, label: "4 שניות" },
        { value: 8 as const, label: "8 שניות" },
        { value: 15 as const, label: "15 שניות", tag: "מורחב" },
    ];

    const ratios = [
        { value: "16:9", label: "16:9 רוחבי" },
        { value: "9:16", label: "9:16 אנכי" },
    ];

    return (
        <div className="pb-20 lg:pb-0" dir="rtl">
            <div className="max-w-3xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold mb-1 flex items-center gap-2">
                        <Video className="h-6 w-6 sm:h-7 sm:w-7 text-blue-500" />
                        יצירת סרטון מטקסט
                    </h1>
                    <p className="text-gray-500 text-sm sm:text-base">
                        תאר את הסרטון שברצונך ליצור ו-AI ייצור אותו עבורך
                    </p>
                </div>

                <Card className="mb-4 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base sm:text-lg">תיאור הסרטון</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Textarea
                            placeholder="תאר את הסרטון שברצונך ליצור... לדוגמה: גלים שוברים על חוף סלעי בשקיעה, מבט מלמעלה"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            rows={4}
                            className="text-base min-h-[100px] resize-none"
                            disabled={isGenerating}
                        />

                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-700">
                                משך הסרטון
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {durations.map((d) => (
                                    <button
                                        key={d.value}
                                        type="button"
                                        onClick={() => setDuration(d.value)}
                                        disabled={isGenerating}
                                        className={`relative py-3 rounded-lg border-2 font-medium transition-all duration-200 min-h-[48px] cursor-pointer text-sm sm:text-base ${
                                            duration === d.value
                                                ? "bg-blue-50 border-blue-500 text-blue-700"
                                                : "bg-white border-gray-200 text-gray-600 hover:border-blue-300"
                                        }`}
                                    >
                                        {d.label}
                                        {d.tag && (
                                            <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] px-1.5 py-0.5 bg-blue-500 text-white rounded-full font-bold">
                                                {d.tag}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-700">
                                יחס תצוגה
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {ratios.map(({ value, label }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setAspectRatio(value)}
                                        disabled={isGenerating}
                                        className={`py-3 rounded-lg border-2 font-medium transition-all duration-200 min-h-[48px] cursor-pointer text-sm sm:text-base ${
                                            aspectRatio === value
                                                ? "bg-blue-50 border-blue-500 text-blue-700"
                                                : "bg-white border-gray-200 text-gray-600 hover:border-blue-300"
                                        }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg text-sm text-amber-700 flex items-center gap-2">
                            <Sparkles className="h-4 w-4 flex-shrink-0" />
                            <span>יצירת סרטון עולה 3 קרדיטים ואורכת כ-2-3 דקות</span>
                        </div>

                        {/* Sticky on mobile */}
                        <div className="sticky bottom-20 lg:static lg:bottom-auto bg-white pt-2 pb-2 lg:pb-0 z-10">
                            <Button
                                onClick={handleGenerate}
                                disabled={!prompt.trim() || isGenerating}
                                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/20"
                                size="lg"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                                        יוצר סרטון... {Math.round(progress)}%
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="ml-2 h-5 w-5" />
                                        צור סרטון (3 קרדיטים)
                                    </>
                                )}
                            </Button>
                        </div>

                        {isGenerating && (
                            <div className="space-y-2">
                                <Progress value={progress} className="h-2" />
                                <p className="text-xs text-center text-gray-400 animate-pulse">
                                    {statusText || `${progress}% הושלם`}
                                </p>
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded-lg text-sm">
                                {error}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {result && (
                    <Card className="shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                                <Video className="h-5 w-5 text-emerald-500" />
                                הסרטון שלך מוכן!
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <video
                                src={result}
                                controls
                                className="w-full rounded-lg shadow-md"
                                autoPlay
                                loop
                            />
                            <Button
                                onClick={handleDownload}
                                variant="secondary"
                                className="w-full"
                                size="lg"
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
