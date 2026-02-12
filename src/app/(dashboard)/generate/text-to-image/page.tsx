"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
    Loader2,
    Download,
    Sparkles,
    Image as ImageIcon,
} from "lucide-react";
import { ExportFormats } from "@/components/export-formats";
import { useNotifications } from "@/lib/notifications/notification-context";

export default function TextToImagePage() {
    const [prompt, setPrompt] = useState("");
    const [enhancePrompt, setEnhancePrompt] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<string[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    const { addGenerationNotification } = useNotifications();

    const handleGenerate = async () => {
        if (!prompt.trim()) return;

        setIsGenerating(true);
        setProgress(0);
        setError(null);
        setResult(null);

        try {
            const response = await fetch("/api/generate/text-to-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt, enhanceWithAI: enhancePrompt }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "שגיאה ביצירת התמונה");
            }

            const { jobId } = await response.json();

            // Poll for job status
            const pollInterval = setInterval(async () => {
                const jobResponse = await fetch(`/api/jobs/${jobId}`);
                const job = await jobResponse.json();

                setProgress(job.progress);

                if (job.status === "completed") {
                    clearInterval(pollInterval);
                    setResult(job.result.images);
                    setIsGenerating(false);
                    addGenerationNotification("image", job.result.images?.length);
                } else if (job.status === "failed") {
                    clearInterval(pollInterval);
                    setError(job.error || "שגיאה ביצירת התמונה");
                    setIsGenerating(false);
                }
            }, 1000);
        } catch (err: any) {
            setError(err.message);
            setIsGenerating(false);
        }
    };

    const handleDownload = async (url: string, index: number) => {
        const response = await fetch(url);
        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `generated-image-${index + 1}.png`;
        a.click();
        URL.revokeObjectURL(downloadUrl);
    };

    return (
        <div className="container mx-auto py-8 px-4" dir="rtl">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                        <ImageIcon className="h-8 w-8 text-purple-500" />
                        יצירת תמונה מטקסט
                    </h1>
                    <p className="text-gray-600">
                        תאר את התמונה שברצונך ליצור ו-AI ייצור אותה עבורך
                    </p>
                </div>

                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>תיאור התמונה</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Textarea
                            placeholder="תאר את התמונה שברצונך ליצור... לדוגמה: נוף הרים עם שקיעה ורודה, סגנון ציור שמן"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            rows={4}
                            className="text-right"
                            disabled={isGenerating}
                        />

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="enhance"
                                checked={enhancePrompt}
                                onChange={(e) => setEnhancePrompt(e.target.checked)}
                                className="rounded"
                                disabled={isGenerating}
                            />
                            <label
                                htmlFor="enhance"
                                className="text-sm flex items-center gap-1"
                            >
                                <Sparkles className="h-4 w-4 text-yellow-500" />
                                שפר את התיאור באמצעות AI
                            </label>
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
                                    יוצר תמונה...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="ml-2 h-5 w-5" />
                                    צור תמונה (1 קרדיט)
                                </>
                            )}
                        </Button>

                        {isGenerating && (
                            <div className="space-y-2">
                                <Progress value={progress} />
                                <p className="text-sm text-center text-gray-500">
                                    {progress}% הושלם
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

                {result && result.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>תוצאות</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {result.map((imageUrl, index) => (
                                    <div key={index} className="space-y-3">
                                        <div className="relative group">
                                            <img
                                                src={imageUrl}
                                                alt={`Generated image ${index + 1}`}
                                                className="w-full rounded-lg shadow-lg"
                                            />
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => handleDownload(imageUrl, index)}
                                            >
                                                <Download className="h-4 w-4 ml-1" />
                                                הורד מקורי
                                            </Button>
                                        </div>
                                        <ExportFormats
                                            imageUrl={imageUrl}
                                            baseFilename={`generated-image-${index + 1}`}
                                        />
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