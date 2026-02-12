"use client";

import { useState, useRef } from "react";
import { Film, Download, Loader2, AlertCircle, CheckCircle, Upload, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { useNotifications } from "@/lib/notifications/notification-context";
import { CREDIT_COSTS } from "@/lib/config/credits";
import { createClient } from "@/lib/supabase/client";

interface ExtractedImage {
    url: string;
    timestamp: number;
    score: number;
}

export default function VideoToImagesPage() {
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [backgroundImage, setBackgroundImage] = useState<File | null>(null);
    const [imageCount, setImageCount] = useState<"5" | "10" | "15">("10");
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState("");
    const [extractedImages, setExtractedImages] = useState<ExtractedImage[]>([]);
    const [mergedVideoUrl, setMergedVideoUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const { addGenerationNotification } = useNotifications();

    const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 100 * 1024 * 1024) {
                toast.error("גודל הקובץ חייב להיות עד 100MB");
                return;
            }
            setVideoFile(file);
            setError(null);
        }
    };

    const handleBackgroundChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setBackgroundImage(file);
        }
    };

    const handleProcess = async () => {
        if (!videoFile) {
            toast.error("נא להעלות קובץ וידאו");
            return;
        }

        setLoading(true);
        setProgress(0);
        setError(null);
        setExtractedImages([]);
        setMergedVideoUrl(null);

        try {
            // Upload video directly to Supabase Storage (bypasses Vercel 4.5MB limit)
            setProgressText("מעלה וידאו...");
            setProgress(5);

            const supabase = createClient();
            const videoExt = videoFile.name.split(".").pop() || "mp4";
            const videoFileName = `uploads/${Date.now()}_${Math.random().toString(36).slice(2)}.${videoExt}`;

            const { data: videoUploadData, error: videoUploadError } = await supabase.storage
                .from("content")
                .upload(videoFileName, videoFile, {
                    contentType: videoFile.type,
                    upsert: false,
                });

            if (videoUploadError) {
                throw new Error("שגיאה בהעלאת וידאו: " + videoUploadError.message);
            }

            const { data: { publicUrl: videoUrl } } = supabase.storage
                .from("content")
                .getPublicUrl(videoFileName);

            setProgress(20);

            // Upload background image directly if provided
            let backgroundUrl: string | null = null;
            if (backgroundImage) {
                setProgressText("מעלה תמונת רקע...");
                const bgExt = backgroundImage.name.split(".").pop() || "jpg";
                const bgFileName = `uploads/${Date.now()}_bg_${Math.random().toString(36).slice(2)}.${bgExt}`;

                const { error: bgUploadError } = await supabase.storage
                    .from("content")
                    .upload(bgFileName, backgroundImage, {
                        contentType: backgroundImage.type,
                        upsert: false,
                    });

                if (bgUploadError) {
                    throw new Error("שגיאה בהעלאת תמונת רקע: " + bgUploadError.message);
                }

                const { data: { publicUrl: bgPublicUrl } } = supabase.storage
                    .from("content")
                    .getPublicUrl(bgFileName);
                backgroundUrl = bgPublicUrl;
            }

            setProgress(30);
            setProgressText("מתחיל עיבוד...");

            // Send only URLs to processing API (small JSON payload)
            const response = await fetch("/api/generate/video-to-images", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    videoUrl,
                    backgroundUrl,
                    imageCount: parseInt(imageCount),
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    throw new Error(errorText || "שגיאה בעיבוד");
                }
                throw new Error(errorData.error || "שגיאה בעיבוד");
            }

            const { jobId } = await response.json();
            setProgress(20);
            setProgressText("מעבד וידאו...");

            let attempts = 0;
            const maxAttempts = 120; // 4 minutes max

            while (attempts < maxAttempts) {
                await new Promise((resolve) => setTimeout(resolve, 2000));

                const statusResponse = await fetch(`/api/jobs/${jobId}`);
                const status = await statusResponse.json();

                if (status.status === "completed") {
                    setProgress(100);
                    setProgressText("הושלם!");
                    if (status.result.images) {
                        setExtractedImages(status.result.images);
                    }
                    if (status.result.videoUrl) {
                        setMergedVideoUrl(status.result.videoUrl);
                    }
                    toast.success("העיבוד הושלם בהצלחה! 🎉");
                    addGenerationNotification("image", status.result.images?.length || 0);
                    break;
                }

                if (status.status === "failed") {
                    throw new Error(status.error || "העיבוד נכשל");
                }

                if (status.progress) {
                    setProgress(20 + status.progress * 0.8);
                }

                if (status.progress < 30) {
                    setProgressText("מנתח וידאו...");
                } else if (status.progress < 60) {
                    setProgressText("מזהה selfie ומחלץ תמונות...");
                } else if (status.progress < 85) {
                    setProgressText("ממזג עם רקע...");
                } else {
                    setProgressText("מסיים...");
                }

                attempts++;
            }

            if (attempts >= maxAttempts) {
                throw new Error("הזמן הקצוב עבר. נסה שוב.");
            }
        } catch (err: any) {
            setError(err.message);
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const downloadImage = async (image: ExtractedImage, index: number) => {
        try {
            const response = await fetch(image.url);
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = `extracted-image-${index + 1}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
            toast.success(`תמונה ${index + 1} הורדה!`);
        } catch {
            toast.error("שגיאה בהורדה");
        }
    };

    const downloadAllImages = async () => {
        toast.info("מוריד את כל התמונות...");
        for (let i = 0; i < extractedImages.length; i++) {
            await downloadImage(extractedImages[i], i);
            await new Promise((r) => setTimeout(r, 500));
        }
        toast.success("כל התמונות הורדו!");
    };

    const downloadVideo = async () => {
        if (!mergedVideoUrl) return;
        try {
            const response = await fetch(mergedVideoUrl);
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = `merged-video.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
            toast.success("הווידאו הורד!");
        } catch {
            toast.error("שגיאה בהורדת הווידאו");
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Film className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold">וידאו לתמונות</h1>
                            <Badge variant="secondary">חדש</Badge>
                        </div>
                        <p className="text-gray-600">
                            העלה וידאו וקבל את התמונות הטובות ביותר עם selfie segmentation
                        </p>
                    </div>
                </div>
            </div>

            <Card className="mb-8">
                <CardContent className="p-6 space-y-6">
                    {/* Video Upload */}
                    <div>
                        <Label className="text-sm font-medium mb-2 block">העלה וידאו (עד 100MB)</Label>
                        <div className="flex gap-3">
                            <Input
                                ref={videoInputRef}
                                type="file"
                                accept="video/*"
                                onChange={handleVideoChange}
                                disabled={loading}
                                className="flex-1"
                            />
                            {videoFile && (
                                <Badge variant="outline" className="flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4" />
                                    {(videoFile.size / (1024 * 1024)).toFixed(2)} MB
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* Image Count Selection */}
                    <div>
                        <Label className="text-sm font-medium mb-3 block">מספר תמונות לחילוץ</Label>
                        <RadioGroup value={imageCount} onValueChange={(v) => setImageCount(v as "5" | "10" | "15")} disabled={loading}>
                            <div className="flex gap-4">
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="5" id="count-5" />
                                    <Label htmlFor="count-5" className="cursor-pointer">5 תמונות</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="10" id="count-10" />
                                    <Label htmlFor="count-10" className="cursor-pointer">10 תמונות</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="15" id="count-15" />
                                    <Label htmlFor="count-15" className="cursor-pointer">15 תמונות</Label>
                                </div>
                            </div>
                        </RadioGroup>
                    </div>

                    {/* Background Image Upload (Optional) */}
                    <div>
                        <Label className="text-sm font-medium mb-2 block">
                            תמונת רקע (אופציונלי) - למזג עם הווידאו
                        </Label>
                        <div className="flex gap-3">
                            <Input
                                ref={imageInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleBackgroundChange}
                                disabled={loading}
                                className="flex-1"
                            />
                            {backgroundImage && (
                                <Badge variant="outline" className="flex items-center gap-2">
                                    <ImageIcon className="h-4 w-4" />
                                    {backgroundImage.name}
                                </Badge>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            אם תעלה תמונת רקע, הווידאו ימוזג עם הרקע (selfie segmentation)
                        </p>
                    </div>

                    {/* Process Button */}
                    <Button onClick={handleProcess} disabled={!videoFile || loading} size="lg" className="w-full">
                        {loading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                                מעבד...
                            </>
                        ) : (
                            "התחל עיבוד"
                        )}
                    </Button>

                    <div className="flex items-center justify-between pt-2 border-t">
                        <p className="text-sm text-gray-500">✓ מחפש selfie segmentation ומחלץ תמונות חדות</p>
                        <p className="text-sm text-primary font-medium">
                            עלות: {CREDIT_COSTS.video_generation || 25} קרדיטים
                        </p>
                    </div>
                </CardContent>
            </Card>

            {loading && (
                <Card className="mb-8">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">{progressText}</span>
                            <span className="text-sm font-medium">{Math.round(progress)}%</span>
                        </div>
                        <Progress value={progress} />
                    </CardContent>
                </Card>
            )}

            {error && (
                <Card className="mb-8 border-red-200 bg-red-50">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3 text-red-700">
                            <AlertCircle className="h-5 w-5" />
                            <span>{error}</span>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Extracted Images */}
            {extractedImages.length > 0 && (
                <Card className="mb-8">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <CheckCircle className="h-5 w-5 text-green-500" />
                                <h2 className="text-lg font-semibold">
                                    התמונות שלך מוכנות! ({extractedImages.length} תמונות)
                                </h2>
                            </div>
                            <Button onClick={downloadAllImages} variant="outline">
                                <Download className="h-4 w-4 ml-2" />
                                הורד הכל
                            </Button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {extractedImages.map((image, index) => (
                                <div
                                    key={index}
                                    className="relative group aspect-square rounded-lg overflow-hidden border bg-gray-100"
                                >
                                    <img
                                        src={image.url}
                                        alt={`Extracted ${index + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => downloadImage(image, index)}
                                        >
                                            <Download className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                                        {index + 1}/{extractedImages.length}
                                    </div>
                                    <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                                        Score: {image.score.toFixed(2)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Merged Video */}
            {mergedVideoUrl && (
                <Card className="mb-8">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <CheckCircle className="h-5 w-5 text-green-500" />
                                <h2 className="text-lg font-semibold">הווידאו הממוזג מוכן!</h2>
                            </div>
                            <Button onClick={downloadVideo} variant="outline">
                                <Download className="h-4 w-4 ml-2" />
                                הורד וידאו
                            </Button>
                        </div>
                        <div className="rounded-lg overflow-hidden border">
                            <video src={mergedVideoUrl} controls className="w-full" />
                        </div>
                    </CardContent>
                </Card>
            )}

            {!loading && extractedImages.length === 0 && (
                <Card className="bg-blue-50 border-blue-100">
                    <CardContent className="p-6">
                        <h3 className="font-medium mb-2">💡 טיפים</h3>
                        <ul className="text-sm text-gray-600 space-y-1">
                            <li>• המערכת מחפשת selfie segmentation ומחלצת תמונות חדות</li>
                            <li>• תמונת רקע אופציונלית - אם תעלה, הווידאו ימוזג עם הרקע</li>
                            <li>• העיבוד לוקח בין 1 ל-3 דקות בהתאם לאורך הווידאו</li>
                            <li>• גודל מקסימלי: 100MB</li>
                        </ul>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
