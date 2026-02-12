"use client";

import { useState, useRef, useCallback } from "react";
import { Film, Download, Loader2, AlertCircle, CheckCircle, ImageIcon } from "lucide-react";
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

interface ExtractedImage {
    url: string;
    timestamp: number;
    score: number;
}

export default function VideoToImagesPage() {
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [imageCount, setImageCount] = useState<"5" | "10" | "15">("10");
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState("");
    const [extractedImages, setExtractedImages] = useState<ExtractedImage[]>([]);
    const [error, setError] = useState<string | null>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);

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

    // ─── Client-Side Frame Extraction ────────────────────────────────

    /**
     * Extract frames from video using HTML5 Video + Canvas.
     * Runs entirely in the browser — no server-side FFmpeg needed.
     */
    const extractFramesClientSide = useCallback(
        async (
            file: File,
            count: number,
            onProgress: (pct: number, text: string) => void
        ): Promise<Array<{ blob: Blob; timestamp: number; score: number }>> => {
            return new Promise((resolve, reject) => {
                const video = document.createElement("video");
                video.preload = "auto";
                video.muted = true;
                video.playsInline = true;

                const objectUrl = URL.createObjectURL(file);
                video.src = objectUrl;

                video.onloadedmetadata = async () => {
                    try {
                        const duration = video.duration;
                        if (!duration || duration < 1) {
                            throw new Error("וידאו קצר מדי או לא תקין");
                        }

                        // Sample more frames than needed so we can pick the best
                        const samplesToTake = Math.min(count * 3, Math.floor(duration));
                        const interval = duration / (samplesToTake + 1);

                        const canvas = document.createElement("canvas");
                        const ctx = canvas.getContext("2d")!;

                        const allFrames: Array<{
                            blob: Blob;
                            timestamp: number;
                            score: number;
                        }> = [];

                        onProgress(10, "מנתח וידאו...");

                        for (let i = 0; i < samplesToTake; i++) {
                            const timestamp = interval * (i + 1);

                            // Seek to timestamp
                            await seekTo(video, timestamp);

                            // Draw frame to canvas
                            canvas.width = video.videoWidth;
                            canvas.height = video.videoHeight;
                            ctx.drawImage(video, 0, 0);

                            // Calculate sharpness score
                            const score = calculateSharpness(
                                ctx,
                                canvas.width,
                                canvas.height
                            );

                            // Convert to blob
                            const blob = await canvasToBlob(canvas);

                            allFrames.push({ blob, timestamp, score });

                            // Update progress
                            const pct = 10 + Math.floor(((i + 1) / samplesToTake) * 60);
                            onProgress(pct, `מחלץ תמונות... (${i + 1}/${samplesToTake})`);
                        }

                        // Sort by score and pick the best N
                        allFrames.sort((a, b) => b.score - a.score);
                        const bestFrames = allFrames.slice(0, count);

                        // Sort best frames by timestamp for display order
                        bestFrames.sort((a, b) => a.timestamp - b.timestamp);

                        URL.revokeObjectURL(objectUrl);
                        resolve(bestFrames);
                    } catch (err) {
                        URL.revokeObjectURL(objectUrl);
                        reject(err);
                    }
                };

                video.onerror = () => {
                    URL.revokeObjectURL(objectUrl);
                    reject(new Error("לא ניתן לקרוא את הווידאו. נסה פורמט אחר."));
                };
            });
        },
        []
    );

    /** Seek video to a specific time and wait for it to be ready */
    function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
        return new Promise((resolve) => {
            const onSeeked = () => {
                video.removeEventListener("seeked", onSeeked);
                resolve();
            };
            video.addEventListener("seeked", onSeeked);
            video.currentTime = time;
        });
    }

    /** Convert canvas to JPEG blob */
    function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
        return new Promise((resolve, reject) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error("Failed to create blob"));
                },
                "image/jpeg",
                0.92
            );
        });
    }

    /**
     * Calculate image sharpness using Laplacian variance.
     * Higher variance = sharper image.
     */
    function calculateSharpness(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number
    ): number {
        // Downsample for speed
        const sw = Math.min(width, 320);
        const sh = Math.min(height, 240);
        const smallCanvas = document.createElement("canvas");
        smallCanvas.width = sw;
        smallCanvas.height = sh;
        const smallCtx = smallCanvas.getContext("2d")!;
        smallCtx.drawImage(ctx.canvas, 0, 0, sw, sh);

        const imageData = smallCtx.getImageData(0, 0, sw, sh);
        const data = imageData.data;

        // Convert to grayscale and calculate variance
        let sum = 0;
        let sumSq = 0;
        const len = sw * sh;

        for (let i = 0; i < data.length; i += 4) {
            const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            sum += gray;
            sumSq += gray * gray;
        }

        const mean = sum / len;
        const variance = sumSq / len - mean * mean;
        return variance;
    }

    // ─── Upload Helper ──────────────────────────────────────────────

    async function uploadFrameWithSignedUrl(
        blob: Blob,
        index: number
    ): Promise<string> {
        // Get signed upload URL
        const res = await fetch("/api/storage/signed-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileExt: "jpg", contentType: "image/jpeg" }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: "שגיאה" }));
            throw new Error(err.error || "שגיאה ביצירת קישור העלאה");
        }

        const { signedUrl, publicUrl } = await res.json();

        // Upload directly to Supabase
        const uploadRes = await fetch(signedUrl, {
            method: "PUT",
            headers: { "Content-Type": "image/jpeg" },
            body: blob,
        });

        if (!uploadRes.ok) {
            throw new Error(`שגיאה בהעלאת תמונה ${index + 1}`);
        }

        return publicUrl;
    }

    // ─── Main Process Handler ───────────────────────────────────────

    const handleProcess = async () => {
        if (!videoFile) {
            toast.error("נא להעלות קובץ וידאו");
            return;
        }

        setLoading(true);
        setProgress(0);
        setError(null);
        setExtractedImages([]);

        try {
            const count = parseInt(imageCount);

            // Step 1: Extract frames client-side (no server needed!)
            const frames = await extractFramesClientSide(
                videoFile,
                count,
                (pct, text) => {
                    setProgress(pct);
                    setProgressText(text);
                }
            );

            if (frames.length === 0) {
                throw new Error("לא הצלחנו לחלץ תמונות מהווידאו");
            }

            // Step 2: Upload frames to Supabase Storage
            setProgressText("מעלה תמונות...");
            setProgress(75);

            const uploadedImages: ExtractedImage[] = [];
            for (let i = 0; i < frames.length; i++) {
                const frame = frames[i];
                const url = await uploadFrameWithSignedUrl(frame.blob, i);
                uploadedImages.push({
                    url,
                    timestamp: frame.timestamp,
                    score: frame.score,
                });

                const pct = 75 + Math.floor(((i + 1) / frames.length) * 15);
                setProgress(pct);
                setProgressText(`מעלה תמונות... (${i + 1}/${frames.length})`);
            }

            // Step 3: Save generation record + deduct credits
            setProgressText("שומר...");
            setProgress(95);

            const saveRes = await fetch("/api/generate/video-to-images", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    imageUrls: uploadedImages.map((img) => img.url),
                    imageCount: uploadedImages.length,
                }),
            });

            if (!saveRes.ok) {
                const errData = await saveRes.json().catch(() => ({ error: "שגיאה" }));
                // If credit error, still show images (they're already extracted)
                if (errData.code === "INSUFFICIENT_CREDITS") {
                    toast.error(errData.error);
                } else {
                    console.warn("Save error:", errData.error);
                }
            }

            // Done!
            setProgress(100);
            setProgressText("הושלם!");
            setExtractedImages(uploadedImages);
            toast.success(`חולצו ${uploadedImages.length} תמונות בהצלחה! 🎉`);
            addGenerationNotification("image", uploadedImages.length);
        } catch (err: any) {
            setError(err.message);
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    // ─── Download Helpers ───────────────────────────────────────────

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

    // ─── Render ─────────────────────────────────────────────────────

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
                            העלה וידאו וקבל את התמונות הטובות והחדות ביותר
                        </p>
                    </div>
                </div>
            </div>

            <Card className="mb-8">
                <CardContent className="p-6 space-y-6">
                    {/* Video Upload */}
                    <div>
                        <Label className="text-sm font-medium mb-2 block">
                            העלה וידאו (עד 100MB)
                        </Label>
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
                                    {(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* Image Count Selection */}
                    <div>
                        <Label className="text-sm font-medium mb-3 block">
                            מספר תמונות לחילוץ
                        </Label>
                        <RadioGroup
                            value={imageCount}
                            onValueChange={(v) => setImageCount(v as "5" | "10" | "15")}
                            disabled={loading}
                        >
                            <div className="flex gap-4">
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="5" id="count-5" />
                                    <Label htmlFor="count-5" className="cursor-pointer">
                                        5 תמונות
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="10" id="count-10" />
                                    <Label htmlFor="count-10" className="cursor-pointer">
                                        10 תמונות
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="15" id="count-15" />
                                    <Label htmlFor="count-15" className="cursor-pointer">
                                        15 תמונות
                                    </Label>
                                </div>
                            </div>
                        </RadioGroup>
                    </div>

                    {/* Process Button */}
                    <Button
                        onClick={handleProcess}
                        disabled={!videoFile || loading}
                        size="lg"
                        className="w-full"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                                {progressText || "מעבד..."}
                            </>
                        ) : (
                            "התחל עיבוד"
                        )}
                    </Button>

                    <div className="flex items-center justify-between pt-2 border-t">
                        <p className="text-sm text-gray-500">
                            ✓ מחלץ תמונות חדות ואיכותיות מהווידאו
                        </p>
                        <p className="text-sm text-primary font-medium">
                            עלות: {CREDIT_COSTS.video_generation || 25} קרדיטים
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Progress */}
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

            {/* Error */}
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
                                    <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                                        {Math.round(image.timestamp)}s
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Tips */}
            {!loading && extractedImages.length === 0 && (
                <Card className="bg-blue-50 border-blue-100">
                    <CardContent className="p-6">
                        <h3 className="font-medium mb-2">💡 טיפים</h3>
                        <ul className="text-sm text-gray-600 space-y-1">
                            <li>• המערכת מחלצת פריימים מהווידאו ובוחרת את החדים ביותר</li>
                            <li>• העיבוד מתבצע בדפדפן - מהיר ופרטי</li>
                            <li>• מומלץ להשתמש בווידאו באיכות גבוהה</li>
                            <li>• גודל מקסימלי: 100MB</li>
                        </ul>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
