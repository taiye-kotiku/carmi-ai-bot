"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, Download, Sparkles, Video } from "lucide-react";

export default function TextToVideoPage() {
    const [prompt, setPrompt] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;

        setIsGenerating(true);
        setProgress(0);
        setError(null);
        setResult(null);

        try {
            const response = await fetch("/api/generate/text-to-video", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "שגיאה ביצירת הסרטון");
            }

            const { jobId } = await response.json();

            // Poll for job status
            const pollInterval = setInterval(async () => {
                const jobResponse = await fetch(`/api/jobs/${jobId}`);
                const job = await jobResponse.json();

                setProgress(job.progress);

                if (job.status === "completed") {
                    clearInterval(pollInterval);
                    setResult(job.result.videoUrl);
                    setIsGenerating(false);
                } else if (job.status === "failed") {
                    clearInterval(pollInterval);
                    setError(job.error || "שגיאה ביצירת הסרטון");
                    setIsGenerating(false);
                }
            }, 2000);

        } catch (err: any) {
            setError(err.message);
            setIsGenerating(false);
        }
    };

    const handleDownload = async () => {
        if (!result) return;
        const response = await fetch(result);
        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = "generated-video.mp4";
        a.click();
        URL.revokeObjectURL(downloadUrl);
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