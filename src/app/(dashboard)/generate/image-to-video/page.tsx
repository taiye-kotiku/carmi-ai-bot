"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, Download, Sparkles, Upload, Video, X } from "lucide-react";
import { useNotifications } from "@/lib/notifications/notification-context";

export default function ImageToVideoPage() {
    const [image, setImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [prompt, setPrompt] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { addGenerationNotification } = useNotifications();

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImage(file);
            const reader = new FileReader();
            reader.onload = (e) => {
                setImagePreview(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveImage = () => {
        setImage(null);
        setImagePreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleGenerate = async () => {
        if (!image) return;

        setIsGenerating(true);
        setProgress(0);
        setError(null);
        setResult(null);

        try {
            const formData = new FormData();
            formData.append("image", image);
            formData.append("prompt", prompt);

            const response = await fetch("/api/generate/image-to-video", {
                method: "POST",
                body: formData,
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
                    addGenerationNotification("video");
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
        a.download = "animated-image.mp4";
        a.click();
        URL.revokeObjectURL(downloadUrl);
    };

    return (
        <div className="container mx-auto py-8 px-4" dir="rtl">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                        <Video className="h-8 w-8 text-green-500" />
                        הנפשת תמונה לסרטון
                    </h1>
                    <p className="text-gray-600">
                        העלה תמונה וה-AI יהפוך אותה לסרטון מונפש
                    </p>
                </div>

                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>העלה תמונה</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {!imagePreview ? (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-purple-500 transition-colors"
                            >
                                <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                                <p className="text-gray-600 mb-2">לחץ להעלאת תמונה</p>
                                <p className="text-sm text-gray-400">PNG, JPG עד 10MB</p>
                            </div>
                        ) : (
                            <div className="relative">
                                <img
                                    src={imagePreview}
                                    alt="Preview"
                                    className="w-full max-h-96 object-contain rounded-lg"
                                />
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="absolute top-2 left-2"
                                    onClick={handleRemoveImage}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        )}

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageSelect}
                            className="hidden"
                        />

                        <Textarea
                            placeholder="(אופציונלי) תאר איך התמונה צריכה לזוז... לדוגמה: תנועת שיער ברוח, עננים זזים"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            rows={3}
                            className="text-right"
                            disabled={isGenerating}
                        />

                        <div className="bg-yellow-50 p-3 rounded-lg text-sm text-yellow-700">
                            💡 הנפשת תמונה עולה 3 קרדיטים ואורכת כ-2-3 דקות
                        </div>

                        <Button
                            onClick={handleGenerate}
                            disabled={!image || isGenerating}
                            className="w-full"
                            size="lg"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                                    מנפיש תמונה...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="ml-2 h-5 w-5" />
                                    הנפש תמונה (3 קרדיטים)
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