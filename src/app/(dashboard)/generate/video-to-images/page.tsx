"use client";

import { useState, useRef } from "react";
import {
    Film,
    Download,
    Loader2,
    AlertCircle,
    CheckCircle,
    ImageIcon,
    X,
} from "lucide-react";
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

/* ───────────────────────────── Types ─────────────────────────────── */

interface ExtractedImage {
    url: string;
    timestamp: number;
    score: number;
}

interface FrameData {
    blob: Blob;
    timestamp: number;
    sharpness: number;
    personScore: number;
    combinedScore: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type SegmenterInstance = any;
/* eslint-enable @typescript-eslint/no-explicit-any */

/* ────────────────────────── Component ────────────────────────────── */

export default function VideoToImagesPage() {
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [backgroundImage, setBackgroundImage] = useState<File | null>(null);
    const [backgroundPreview, setBackgroundPreview] = useState<string | null>(
        null
    );
    const [imageCount, setImageCount] = useState<"5" | "10" | "15">("10");
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState("");
    const [extractedImages, setExtractedImages] = useState<ExtractedImage[]>([]);
    const [error, setError] = useState<string | null>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const bgInputRef = useRef<HTMLInputElement>(null);

    const { addGenerationNotification } = useNotifications();

    /* ─── File Handlers ─────────────────────────────────────────── */

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
            const reader = new FileReader();
            reader.onload = (ev) =>
                setBackgroundPreview(ev.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const clearBackground = () => {
        setBackgroundImage(null);
        setBackgroundPreview(null);
        if (bgInputRef.current) bgInputRef.current.value = "";
    };

    /* ─── MediaPipe Initialization ──────────────────────────────── */

    async function initSegmenter(): Promise<SegmenterInstance | null> {
        try {
            const { ImageSegmenter, FilesetResolver } = await import(
                "@mediapipe/tasks-vision"
            );

            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
            );

            const segmenter = await ImageSegmenter.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath:
                        "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite",
                    delegate: "GPU",
                },
                runningMode: "IMAGE",
                outputCategoryMask: false,
                outputConfidenceMasks: true,
            });

            return segmenter;
        } catch (err) {
            console.warn(
                "MediaPipe initialisation failed — falling back to sharpness only:",
                err
            );
            return null;
        }
    }

    /* ─── Frame Utilities ───────────────────────────────────────── */

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

    function canvasToBlob(
        canvas: HTMLCanvasElement,
        quality = 0.92
    ): Promise<Blob> {
        return new Promise((resolve, reject) => {
            canvas.toBlob(
                (blob) =>
                    blob
                        ? resolve(blob)
                        : reject(new Error("Failed to create blob")),
                "image/jpeg",
                quality
            );
        });
    }

    /** Laplacian-variance sharpness score */
    function calculateSharpness(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number
    ): number {
        const sw = Math.min(width, 320);
        const sh = Math.min(height, 240);
        const small = document.createElement("canvas");
        small.width = sw;
        small.height = sh;
        const sCtx = small.getContext("2d")!;
        sCtx.drawImage(ctx.canvas, 0, 0, sw, sh);

        const data = sCtx.getImageData(0, 0, sw, sh).data;
        let sum = 0;
        let sumSq = 0;
        const len = sw * sh;
        for (let i = 0; i < data.length; i += 4) {
            const gray =
                data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            sum += gray;
            sumSq += gray * gray;
        }
        const mean = sum / len;
        return sumSq / len - mean * mean;
    }

    /** Run MediaPipe selfie segmentation → returns person confidence 0..1 */
    function getPersonScore(
        segmenter: SegmenterInstance,
        canvas: HTMLCanvasElement
    ): number {
        try {
            const result = segmenter.segment(canvas);
            if (!result.confidenceMasks || result.confidenceMasks.length === 0)
                return 0;

            const mask: Float32Array =
                result.confidenceMasks[0].getAsFloat32Array();
            let personSum = 0;
            for (let i = 0; i < mask.length; i++) personSum += mask[i];

            // Free GPU resources
            result.confidenceMasks.forEach((m: { close: () => void }) =>
                m.close()
            );

            return personSum / mask.length;
        } catch (err) {
            console.warn("Segmentation failed for frame:", err);
            return 0;
        }
    }

    /** Alpha-blend person (from frame) on top of a background image */
    function compositeWithBackground(
        canvas: HTMLCanvasElement,
        segmenter: SegmenterInstance,
        bgImg: HTMLImageElement
    ): void {
        const width = canvas.width;
        const height = canvas.height;
        const ctx = canvas.getContext("2d")!;

        const result = segmenter.segment(canvas);
        if (!result.confidenceMasks || result.confidenceMasks.length === 0)
            return;

        const mask: Float32Array =
            result.confidenceMasks[0].getAsFloat32Array();

        const frameData = ctx.getImageData(0, 0, width, height);

        // Draw & get background pixels at same resolution
        const bgCanvas = document.createElement("canvas");
        bgCanvas.width = width;
        bgCanvas.height = height;
        const bgCtx = bgCanvas.getContext("2d")!;
        bgCtx.drawImage(bgImg, 0, 0, width, height);
        const bgData = bgCtx.getImageData(0, 0, width, height);

        const output = ctx.createImageData(width, height);
        for (let i = 0; i < mask.length; i++) {
            const alpha = mask[i]; // person confidence
            const pi = i * 4;
            output.data[pi] =
                frameData.data[pi] * alpha + bgData.data[pi] * (1 - alpha);
            output.data[pi + 1] =
                frameData.data[pi + 1] * alpha +
                bgData.data[pi + 1] * (1 - alpha);
            output.data[pi + 2] =
                frameData.data[pi + 2] * alpha +
                bgData.data[pi + 2] * (1 - alpha);
            output.data[pi + 3] = 255;
        }
        ctx.putImageData(output, 0, 0);

        result.confidenceMasks.forEach((m: { close: () => void }) => m.close());
    }

    /** Load a File into an HTMLImageElement */
    function loadImage(file: File): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error("Failed to load image"));
            };
            img.src = url;
        });
    }

    /* ─── Upload Helper ─────────────────────────────────────────── */

    async function uploadFrameWithSignedUrl(
        blob: Blob,
        index: number
    ): Promise<string> {
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

        const uploadRes = await fetch(signedUrl, {
            method: "PUT",
            headers: { "Content-Type": "image/jpeg" },
            body: blob,
        });
        if (!uploadRes.ok)
            throw new Error(`שגיאה בהעלאת תמונה ${index + 1}`);

        return publicUrl;
    }

    /* ─── Main Process Handler ──────────────────────────────────── */

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

            /* ── 1. Init MediaPipe ────────────────────────────────── */
            setProgressText("טוען מודל MediaPipe לזיהוי אדם...");
            setProgress(5);
            const segmenter = await initSegmenter();

            if (segmenter) {
                setProgressText("מודל MediaPipe נטען ✓");
            } else {
                setProgressText(
                    "ממשיך ללא זיהוי אדם (שימוש בחדות בלבד)"
                );
            }

            /* ── 2. Load optional background image ────────────────── */
            let bgImg: HTMLImageElement | null = null;
            if (backgroundImage) {
                bgImg = await loadImage(backgroundImage);
            }

            /* ── 3. Extract & score frames ────────────────────────── */
            setProgress(10);
            setProgressText("מחלץ ומנתח פריימים...");

            const video = document.createElement("video");
            video.preload = "auto";
            video.muted = true;
            video.playsInline = true;
            const objectUrl = URL.createObjectURL(videoFile);
            video.src = objectUrl;

            const frames = await new Promise<FrameData[]>((resolve, reject) => {
                video.onloadedmetadata = async () => {
                    try {
                        const duration = video.duration;
                        if (!duration || duration < 1)
                            throw new Error("וידאו קצר מדי או לא תקין");

                        const samplesToTake = Math.max(
                            count,
                            Math.min(count * 3, Math.floor(duration * 2))
                        );
                        const interval = duration / (samplesToTake + 1);

                        const canvas = document.createElement("canvas");
                        const ctx = canvas.getContext("2d")!;
                        const allFrames: FrameData[] = [];

                        for (let i = 0; i < samplesToTake; i++) {
                            const timestamp = interval * (i + 1);
                            await seekTo(video, timestamp);

                            canvas.width = video.videoWidth;
                            canvas.height = video.videoHeight;
                            ctx.drawImage(video, 0, 0);

                            const sharpness = calculateSharpness(
                                ctx,
                                canvas.width,
                                canvas.height
                            );
                            const personScore = segmenter
                                ? getPersonScore(segmenter, canvas)
                                : 0;

                            // Sharpness + heavy person-presence boost
                            const combinedScore =
                                sharpness * (1 + personScore * 2);

                            const blob = await canvasToBlob(canvas);
                            allFrames.push({
                                blob,
                                timestamp,
                                sharpness,
                                personScore,
                                combinedScore,
                            });

                            const pct =
                                10 +
                                Math.floor(
                                    ((i + 1) / samplesToTake) * 50
                                );
                            setProgress(pct);
                            setProgressText(
                                `מנתח פריים ${i + 1}/${samplesToTake}` +
                                    (personScore > 0.1
                                        ? ` (אדם: ${Math.round(
                                              personScore * 100
                                          )}%)`
                                        : "")
                            );
                        }

                        URL.revokeObjectURL(objectUrl);
                        resolve(allFrames);
                    } catch (err) {
                        URL.revokeObjectURL(objectUrl);
                        reject(err);
                    }
                };

                video.onerror = () => {
                    URL.revokeObjectURL(objectUrl);
                    reject(
                        new Error(
                            "לא ניתן לקרוא את הווידאו. נסה פורמט אחר."
                        )
                    );
                };
            });

            if (frames.length === 0)
                throw new Error("לא הצלחנו לחלץ תמונות מהווידאו");

            /* ── 4. Select best frames ────────────────────────────── */
            frames.sort((a, b) => b.combinedScore - a.combinedScore);
            let bestFrames = frames.slice(0, count);
            bestFrames.sort((a, b) => a.timestamp - b.timestamp); // chronological

            setProgress(65);

            /* ── 5. Background replacement on selected frames ─────── */
            if (bgImg && segmenter) {
                setProgressText("מחליף רקע בתמונות נבחרות...");
                const processed: FrameData[] = [];

                for (let i = 0; i < bestFrames.length; i++) {
                    const frame = bestFrames[i];

                    // Reload blob onto a canvas
                    const bmp = await createImageBitmap(frame.blob);
                    const canvas = document.createElement("canvas");
                    canvas.width = bmp.width;
                    canvas.height = bmp.height;
                    const ctx = canvas.getContext("2d")!;
                    ctx.drawImage(bmp, 0, 0);

                    compositeWithBackground(canvas, segmenter, bgImg);

                    const newBlob = await canvasToBlob(canvas);
                    processed.push({ ...frame, blob: newBlob });

                    const pct =
                        65 +
                        Math.floor(
                            ((i + 1) / bestFrames.length) * 10
                        );
                    setProgress(pct);
                    setProgressText(
                        `מחליף רקע... (${i + 1}/${bestFrames.length})`
                    );
                }

                bestFrames = processed;
            }

            // Cleanup segmenter
            if (segmenter) {
                try {
                    segmenter.close();
                } catch {
                    /* ignore */
                }
            }

            /* ── 6. Upload frames ─────────────────────────────────── */
            setProgress(78);
            setProgressText("מעלה תמונות...");

            const uploadedImages: ExtractedImage[] = [];
            for (let i = 0; i < bestFrames.length; i++) {
                const frame = bestFrames[i];
                const url = await uploadFrameWithSignedUrl(frame.blob, i);
                uploadedImages.push({
                    url,
                    timestamp: frame.timestamp,
                    score: frame.combinedScore,
                });

                const pct =
                    78 +
                    Math.floor(((i + 1) / bestFrames.length) * 15);
                setProgress(pct);
                setProgressText(
                    `מעלה תמונות... (${i + 1}/${bestFrames.length})`
                );
            }

            /* ── 7. Save generation + deduct credits ──────────────── */
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
                const errData = await saveRes
                    .json()
                    .catch(() => ({ error: "שגיאה" }));
                if (errData.code === "INSUFFICIENT_CREDITS") {
                    toast.error(errData.error);
                } else {
                    console.warn("Save error:", errData.error);
                }
            }

            /* ── Done ─────────────────────────────────────────────── */
            setProgress(100);
            setProgressText("הושלם!");
            setExtractedImages(uploadedImages);
            toast.success(
                `חולצו ${uploadedImages.length} תמונות בהצלחה!`
            );
            addGenerationNotification("image", uploadedImages.length);
        } catch (err: unknown) {
            const msg =
                err instanceof Error ? err.message : "שגיאה לא ידועה";
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    /* ─── Download Helpers ──────────────────────────────────────── */

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

    /* ─── Render ────────────────────────────────────────────────── */

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Film className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold">
                                וידאו לתמונות
                            </h1>
                            <Badge variant="secondary">MediaPipe AI</Badge>
                        </div>
                        <p className="text-gray-600">
                            חילוץ תמונות חדות עם זיהוי אדם + החלפת רקע
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
                                <Badge
                                    variant="outline"
                                    className="flex items-center gap-2"
                                >
                                    <CheckCircle className="h-4 w-4" />
                                    {(
                                        videoFile.size /
                                        (1024 * 1024)
                                    ).toFixed(1)}{" "}
                                    MB
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* Background Image Upload (optional) */}
                    <div>
                        <Label className="text-sm font-medium mb-2 block">
                            תמונת רקע (אופציונלי — להחלפת רקע)
                        </Label>
                        <div className="flex gap-3 items-center">
                            <Input
                                ref={bgInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleBackgroundChange}
                                disabled={loading}
                                className="flex-1"
                            />
                            {backgroundPreview && (
                                <div className="relative">
                                    <img
                                        src={backgroundPreview}
                                        alt="Background"
                                        className="h-12 w-12 rounded-lg object-cover border"
                                    />
                                    <button
                                        onClick={clearBackground}
                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            אם תעלה תמונת רקע, המערכת תחליף את הרקע בתמונות
                            שבהן זוהה אדם
                        </p>
                    </div>

                    {/* Image Count Selection */}
                    <div>
                        <Label className="text-sm font-medium mb-3 block">
                            מספר תמונות לחילוץ
                        </Label>
                        <RadioGroup
                            value={imageCount}
                            onValueChange={(v) =>
                                setImageCount(v as "5" | "10" | "15")
                            }
                            disabled={loading}
                        >
                            <div className="flex gap-4">
                                {(["5", "10", "15"] as const).map((n) => (
                                    <div
                                        key={n}
                                        className="flex items-center space-x-2"
                                    >
                                        <RadioGroupItem
                                            value={n}
                                            id={`count-${n}`}
                                        />
                                        <Label
                                            htmlFor={`count-${n}`}
                                            className="cursor-pointer"
                                        >
                                            {n} תמונות
                                        </Label>
                                    </div>
                                ))}
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
                            <>
                                <ImageIcon className="h-4 w-4 ml-2" />
                                התחל עיבוד
                            </>
                        )}
                    </Button>

                    <div className="flex items-center justify-between pt-2 border-t">
                        <p className="text-sm text-gray-500">
                            ✓ זיהוי אדם (MediaPipe) + חדות + החלפת רקע
                        </p>
                        <p className="text-sm text-primary font-medium">
                            עלות: {CREDIT_COSTS.video_generation || 25}{" "}
                            קרדיטים
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Progress */}
            {loading && (
                <Card className="mb-8">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">
                                {progressText}
                            </span>
                            <span className="text-sm font-medium">
                                {Math.round(progress)}%
                            </span>
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
                                    התמונות שלך מוכנות! (
                                    {extractedImages.length} תמונות)
                                </h2>
                            </div>
                            <Button
                                onClick={downloadAllImages}
                                variant="outline"
                            >
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
                                            onClick={() =>
                                                downloadImage(image, index)
                                            }
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
                        <h3 className="font-medium mb-2">
                            MediaPipe AI — איך זה עובד?
                        </h3>
                        <ul className="text-sm text-gray-600 space-y-1">
                            <li>
                                • <strong>זיהוי אדם</strong> — המערכת מזהה
                                פריימים שבהם מופיע אדם ומעדיפה אותם
                            </li>
                            <li>
                                • <strong>ניקוד חדות</strong> — פריימים חדים
                                ואיכותיים מקבלים ציון גבוה יותר
                            </li>
                            <li>
                                • <strong>החלפת רקע</strong> — העלה תמונת רקע
                                והמערכת תחליף אוטומטית את הרקע בתמונות הנבחרות
                            </li>
                            <li>
                                • כל העיבוד מתבצע בדפדפן — מהיר ופרטי
                            </li>
                            <li>• גודל מקסימלי: 100MB</li>
                        </ul>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
