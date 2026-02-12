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

/* ═══════════════════════════ Types ═══════════════════════════════ */

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

/* ═══════════════════ Mask Refinement Utilities ═══════════════════ */

/** Separable box blur with running-sum — O(width × height) per pass. */
function boxBlur(
    input: Float32Array<ArrayBuffer>,
    width: number,
    height: number,
    radius: number
): Float32Array<ArrayBuffer> {
    const temp = new Float32Array(input.length);
    const output = new Float32Array(input.length);

    // Horizontal pass
    for (let y = 0; y < height; y++) {
        const row = y * width;
        let sum = 0;
        let count = 0;
        for (let x = 0; x <= radius && x < width; x++) {
            sum += input[row + x];
            count++;
        }
        temp[row] = sum / count;
        for (let x = 1; x < width; x++) {
            const addIdx = x + radius;
            if (addIdx < width) { sum += input[row + addIdx]; count++; }
            const remIdx = x - radius - 1;
            if (remIdx >= 0) { sum -= input[row + remIdx]; count--; }
            temp[row + x] = sum / count;
        }
    }

    // Vertical pass
    for (let x = 0; x < width; x++) {
        let sum = 0;
        let count = 0;
        for (let y = 0; y <= radius && y < height; y++) {
            sum += temp[y * width + x];
            count++;
        }
        output[x] = sum / count;
        for (let y = 1; y < height; y++) {
            const addIdx = y + radius;
            if (addIdx < height) { sum += temp[addIdx * width + x]; count++; }
            const remIdx = y - radius - 1;
            if (remIdx >= 0) { sum -= temp[remIdx * width + x]; count--; }
            output[y * width + x] = sum / count;
        }
    }

    return output;
}

/** Refine a MediaPipe confidence mask for smooth, natural edges. */
function refineMask(
    mask: Float32Array,
    width: number,
    height: number
): Float32Array<ArrayBuffer> {
    // 1. Noise cleanup
    const cleaned = new Float32Array(mask.length);
    for (let i = 0; i < mask.length; i++) {
        const v = mask[i];
        cleaned[i] = v < 0.15 ? 0 : v > 0.85 ? 1 : v;
    }

    // 2. Multi-pass box blur ≈ Gaussian (radius 4, 3 passes)
    let result: Float32Array<ArrayBuffer> = cleaned;
    for (let p = 0; p < 3; p++) {
        result = boxBlur(result, width, height, 4);
    }

    // 3. Smoothstep contrast boost
    for (let i = 0; i < result.length; i++) {
        const v = result[i];
        result[i] = v < 0.02 ? 0 : v > 0.98 ? 1 : v * v * (3 - 2 * v);
    }

    return result;
}

/* ═══════════════════════ Component ═══════════════════════════════ */

export default function VideoToImagesPage() {
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [backgroundImage, setBackgroundImage] = useState<File | null>(null);
    const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);
    const [imageCount, setImageCount] = useState<"5" | "10" | "15">("10");

    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState("");
    const [error, setError] = useState<string | null>(null);

    // Two sets of results
    const [originalImages, setOriginalImages] = useState<ExtractedImage[]>([]);
    const [bgReplacedImages, setBgReplacedImages] = useState<ExtractedImage[]>([]);

    const videoInputRef = useRef<HTMLInputElement>(null);
    const bgInputRef = useRef<HTMLInputElement>(null);
    const { addGenerationNotification } = useNotifications();

    /* ── File Handlers ──────────────────────────────────────────── */

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
            reader.onload = (ev) => setBackgroundPreview(ev.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const clearBackground = () => {
        setBackgroundImage(null);
        setBackgroundPreview(null);
        if (bgInputRef.current) bgInputRef.current.value = "";
    };

    /* ── MediaPipe ──────────────────────────────────────────────── */

    async function initSegmenter(): Promise<SegmenterInstance | null> {
        try {
            const { ImageSegmenter, FilesetResolver } = await import("@mediapipe/tasks-vision");
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
            );
            return await ImageSegmenter.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath:
                        "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite",
                    delegate: "GPU",
                },
                runningMode: "IMAGE",
                outputCategoryMask: false,
                outputConfidenceMasks: true,
            });
        } catch (err) {
            console.warn("MediaPipe init failed:", err);
            return null;
        }
    }

    /* ── Utilities ──────────────────────────────────────────────── */

    function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
        return new Promise((resolve) => {
            const onSeeked = () => { video.removeEventListener("seeked", onSeeked); resolve(); };
            video.addEventListener("seeked", onSeeked);
            video.currentTime = time;
        });
    }

    function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
        return new Promise((resolve, reject) => {
            canvas.toBlob(
                (blob) => (blob ? resolve(blob) : reject(new Error("Failed to create blob"))),
                "image/jpeg",
                quality
            );
        });
    }

    function calculateSharpness(ctx: CanvasRenderingContext2D, width: number, height: number): number {
        const sw = Math.min(width, 320);
        const sh = Math.min(height, 240);
        const small = document.createElement("canvas");
        small.width = sw;
        small.height = sh;
        const sCtx = small.getContext("2d")!;
        sCtx.drawImage(ctx.canvas, 0, 0, sw, sh);
        const data = sCtx.getImageData(0, 0, sw, sh).data;
        let sum = 0, sumSq = 0;
        const len = sw * sh;
        for (let i = 0; i < data.length; i += 4) {
            const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            sum += gray;
            sumSq += gray * gray;
        }
        const mean = sum / len;
        return sumSq / len - mean * mean;
    }

    function getPersonScore(segmenter: SegmenterInstance, canvas: HTMLCanvasElement): number {
        try {
            const result = segmenter.segment(canvas);
            if (!result.confidenceMasks?.length) return 0;
            const mask: Float32Array = result.confidenceMasks[0].getAsFloat32Array();
            let personSum = 0;
            for (let i = 0; i < mask.length; i++) personSum += mask[i];
            result.confidenceMasks.forEach((m: { close: () => void }) => m.close());
            return personSum / mask.length;
        } catch (err) {
            console.warn("Segmentation failed:", err);
            return 0;
        }
    }

    /** Composite person onto background with refined mask */
    function compositeWithRefinedBg(
        canvas: HTMLCanvasElement,
        segmenter: SegmenterInstance,
        bgImg: HTMLImageElement
    ): void {
        const w = canvas.width;
        const h = canvas.height;
        const ctx = canvas.getContext("2d")!;

        const result = segmenter.segment(canvas);
        if (!result.confidenceMasks?.length) return;

        const rawMask: Float32Array = result.confidenceMasks[0].getAsFloat32Array();
        const mask = refineMask(rawMask, w, h);

        const frameData = ctx.getImageData(0, 0, w, h);
        const bgCanvas = document.createElement("canvas");
        bgCanvas.width = w;
        bgCanvas.height = h;
        const bgCtx = bgCanvas.getContext("2d")!;
        bgCtx.drawImage(bgImg, 0, 0, w, h);
        const bgData = bgCtx.getImageData(0, 0, w, h);

        const output = ctx.createImageData(w, h);
        for (let i = 0; i < mask.length; i++) {
            const a = mask[i];
            const j = i * 4;
            output.data[j]     = frameData.data[j] * a + bgData.data[j] * (1 - a);
            output.data[j + 1] = frameData.data[j + 1] * a + bgData.data[j + 1] * (1 - a);
            output.data[j + 2] = frameData.data[j + 2] * a + bgData.data[j + 2] * (1 - a);
            output.data[j + 3] = 255;
        }
        ctx.putImageData(output, 0, 0);
        result.confidenceMasks.forEach((m: { close: () => void }) => m.close());
    }

    function loadImage(file: File): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
            img.src = url;
        });
    }

    /* ── Upload ─────────────────────────────────────────────────── */

    async function uploadFrameWithSignedUrl(blob: Blob, index: number): Promise<string> {
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
        if (!uploadRes.ok) throw new Error(`שגיאה בהעלאת תמונה ${index + 1}`);
        return publicUrl;
    }

    /* ══════════════════ Main Process Handler ═════════════════════ */

    const handleProcess = async () => {
        if (!videoFile) { toast.error("נא להעלות קובץ וידאו"); return; }

        setLoading(true);
        setProgress(0);
        setError(null);
        setOriginalImages([]);
        setBgReplacedImages([]);

        let segmenter: SegmenterInstance | null = null;

        try {
            const count = parseInt(imageCount);

            /* ── 1. Init MediaPipe ───────────────────────────────── */
            setProgressText("טוען מודל MediaPipe לזיהוי אדם...");
            setProgress(5);
            segmenter = await initSegmenter();
            setProgressText(segmenter ? "מודל MediaPipe נטען ✓" : "ממשיך ללא זיהוי אדם (חדות בלבד)");

            /* ── 2. Load background image ────────────────────────── */
            let bgImg: HTMLImageElement | null = null;
            if (backgroundImage) bgImg = await loadImage(backgroundImage);

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
                        if (!duration || duration < 1) throw new Error("וידאו קצר מדי או לא תקין");

                        const samplesToTake = Math.max(count, Math.min(count * 3, Math.floor(duration * 2)));
                        const interval = duration / (samplesToTake + 1);
                        const c = document.createElement("canvas");
                        const cCtx = c.getContext("2d")!;
                        const allFrames: FrameData[] = [];

                        for (let i = 0; i < samplesToTake; i++) {
                            const ts = interval * (i + 1);
                            await seekTo(video, ts);
                            c.width = video.videoWidth;
                            c.height = video.videoHeight;
                            cCtx.drawImage(video, 0, 0);

                            const sharpness = calculateSharpness(cCtx, c.width, c.height);
                            const personScore = segmenter ? getPersonScore(segmenter, c) : 0;
                            const combinedScore = sharpness * (1 + personScore * 2);
                            const blob = await canvasToBlob(c);

                            allFrames.push({ blob, timestamp: ts, sharpness, personScore, combinedScore });

                            const pct = 10 + Math.floor(((i + 1) / samplesToTake) * 30);
                            setProgress(pct);
                            setProgressText(
                                `מנתח פריים ${i + 1}/${samplesToTake}` +
                                (personScore > 0.1 ? ` (אדם: ${Math.round(personScore * 100)}%)` : "")
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
                    reject(new Error("לא ניתן לקרוא את הווידאו. נסה פורמט אחר."));
                };
            });

            if (frames.length === 0) throw new Error("לא הצלחנו לחלץ תמונות מהווידאו");

            /* ── 4. Select best frames ────────────────────────────── */
            frames.sort((a, b) => b.combinedScore - a.combinedScore);
            const bestFrames = frames.slice(0, count);
            bestFrames.sort((a, b) => a.timestamp - b.timestamp);

            /* ── 5. Upload original images ────────────────────────── */
            setProgress(45);
            setProgressText("מעלה תמונות מקוריות...");

            const uploadedOriginals: ExtractedImage[] = [];
            for (let i = 0; i < bestFrames.length; i++) {
                const frame = bestFrames[i];
                const url = await uploadFrameWithSignedUrl(frame.blob, i);
                uploadedOriginals.push({ url, timestamp: frame.timestamp, score: frame.combinedScore });

                const pct = 45 + Math.floor(((i + 1) / bestFrames.length) * 15);
                setProgress(pct);
                setProgressText(`מעלה תמונות מקוריות... (${i + 1}/${bestFrames.length})`);
            }

            setOriginalImages(uploadedOriginals);

            /* ── 6. Create & upload bg-replaced images ────────────── */
            const uploadedBgReplaced: ExtractedImage[] = [];

            if (bgImg && segmenter) {
                setProgress(62);
                setProgressText("מחליף רקע בתמונות...");

                for (let i = 0; i < bestFrames.length; i++) {
                    const frame = bestFrames[i];

                    // Load original blob back onto canvas
                    const bmp = await createImageBitmap(frame.blob);
                    const canvas = document.createElement("canvas");
                    canvas.width = bmp.width;
                    canvas.height = bmp.height;
                    const ctx = canvas.getContext("2d")!;
                    ctx.drawImage(bmp, 0, 0);
                    bmp.close();

                    // Composite with refined mask
                    compositeWithRefinedBg(canvas, segmenter, bgImg);

                    const bgBlob = await canvasToBlob(canvas);
                    const url = await uploadFrameWithSignedUrl(bgBlob, i);
                    uploadedBgReplaced.push({ url, timestamp: frame.timestamp, score: frame.combinedScore });

                    const pct = 62 + Math.floor(((i + 1) / bestFrames.length) * 25);
                    setProgress(pct);
                    setProgressText(`מחליף רקע ומעלה... (${i + 1}/${bestFrames.length})`);
                }

                setBgReplacedImages(uploadedBgReplaced);
            }

            /* ── 7. Save generation + deduct credits ──────────────── */
            setProgressText("שומר...");
            setProgress(90);

            const allImageUrls = [
                ...uploadedOriginals.map((img) => img.url),
                ...uploadedBgReplaced.map((img) => img.url),
            ];

            const saveRes = await fetch("/api/generate/video-to-images", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    imageUrls: allImageUrls,
                    imageCount: allImageUrls.length,
                }),
            });

            if (!saveRes.ok) {
                const errData = await saveRes.json().catch(() => ({ error: "שגיאה" }));
                if (errData.code === "INSUFFICIENT_CREDITS") {
                    toast.error(errData.error);
                } else {
                    console.warn("Save error:", errData.error);
                }
            }

            /* ── Done ─────────────────────────────────────────────── */
            setProgress(100);
            setProgressText("הושלם!");
            const totalCount = uploadedOriginals.length + uploadedBgReplaced.length;
            toast.success(`חולצו ${totalCount} תמונות בהצלחה!`);
            addGenerationNotification("image", totalCount);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "שגיאה לא ידועה";
            setError(msg);
            toast.error(msg);
        } finally {
            if (segmenter) try { segmenter.close(); } catch { /* ignore */ }
            setLoading(false);
        }
    };

    /* ── Download Helpers ────────────────────────────────────────── */

    const downloadImage = async (image: ExtractedImage, index: number, prefix: string) => {
        try {
            const response = await fetch(image.url);
            const blob = await response.blob();
            const u = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = u;
            a.download = `${prefix}-${index + 1}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(u);
            toast.success(`תמונה ${index + 1} הורדה!`);
        } catch {
            toast.error("שגיאה בהורדה");
        }
    };

    const downloadAll = async (images: ExtractedImage[], prefix: string) => {
        toast.info("מוריד תמונות...");
        for (let i = 0; i < images.length; i++) {
            await downloadImage(images[i], i, prefix);
            await new Promise((r) => setTimeout(r, 400));
        }
        toast.success("כל התמונות הורדו!");
    };

    const downloadEverything = async () => {
        toast.info("מוריד את כל התמונות...");
        for (let i = 0; i < originalImages.length; i++) {
            await downloadImage(originalImages[i], i, "original");
            await new Promise((r) => setTimeout(r, 400));
        }
        for (let i = 0; i < bgReplacedImages.length; i++) {
            await downloadImage(bgReplacedImages[i], i, "new-background");
            await new Promise((r) => setTimeout(r, 400));
        }
        toast.success("כל התמונות הורדו!");
    };

    /* ── Image Grid Component ────────────────────────────────────── */

    const ImageGrid = ({
        images,
        prefix,
        title,
        titleIcon,
        borderColor = "",
    }: {
        images: ExtractedImage[];
        prefix: string;
        title: string;
        titleIcon: React.ReactNode;
        borderColor?: string;
    }) => (
        <Card className={`mb-8 ${borderColor}`}>
            <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        {titleIcon}
                        <h2 className="text-lg font-semibold">
                            {title} ({images.length})
                        </h2>
                    </div>
                    <Button onClick={() => downloadAll(images, prefix)} variant="outline">
                        <Download className="h-4 w-4 ml-2" />
                        הורד הכל
                    </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {images.map((image, index) => (
                        <div
                            key={index}
                            className="relative group aspect-square rounded-lg overflow-hidden border bg-gray-100"
                        >
                            <img
                                src={image.url}
                                alt={`${prefix} ${index + 1}`}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => downloadImage(image, index, prefix)}
                                >
                                    <Download className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                                {index + 1}/{images.length}
                            </div>
                            <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                                {Math.round(image.timestamp)}s
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );

    /* ════════════════════════ Render ═════════════════════════════ */

    const hasResults = originalImages.length > 0;

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
                            <h1 className="text-2xl font-bold">וידאו לתמונות</h1>
                            <Badge variant="secondary">MediaPipe AI</Badge>
                        </div>
                        <p className="text-gray-600">
                            חילוץ תמונות חדות מהווידאו + החלפת רקע
                        </p>
                    </div>
                </div>
            </div>

            {/* Form */}
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
                                    {(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* Background Image */}
                    <div>
                        <Label className="text-sm font-medium mb-2 block">תמונת רקע חדשה (אופציונלי)</Label>
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
                            אם תעלה תמונת רקע, תקבל גם סט תמונות עם הרקע החדש
                        </p>
                    </div>

                    {/* Image Count */}
                    <div>
                        <Label className="text-sm font-medium mb-3 block">מספר תמונות לחילוץ</Label>
                        <RadioGroup
                            value={imageCount}
                            onValueChange={(v) => setImageCount(v as "5" | "10" | "15")}
                            disabled={loading}
                        >
                            <div className="flex gap-4">
                                {(["5", "10", "15"] as const).map((n) => (
                                    <div key={n} className="flex items-center space-x-2">
                                        <RadioGroupItem value={n} id={`count-${n}`} />
                                        <Label htmlFor={`count-${n}`} className="cursor-pointer">
                                            {n} תמונות
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        </RadioGroup>
                    </div>

                    {/* Process Button */}
                    <Button onClick={handleProcess} disabled={!videoFile || loading} size="lg" className="w-full">
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

                    <div className="flex items-center justify-between pt-2 border-t text-sm">
                        <span className="text-gray-500">
                            {backgroundImage
                                ? `✓ ${imageCount} תמונות מקוריות + ${imageCount} עם רקע חדש = ${parseInt(imageCount) * 2} סה"כ`
                                : `✓ ${imageCount} תמונות מקוריות`}
                        </span>
                        <span className="text-primary font-medium">
                            עלות: {CREDIT_COSTS.video_generation || 25} קרדיטים
                        </span>
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

            {/* Download All Button (when both sets exist) */}
            {originalImages.length > 0 && bgReplacedImages.length > 0 && (
                <div className="flex justify-end mb-4">
                    <Button onClick={downloadEverything} variant="default">
                        <Download className="h-4 w-4 ml-2" />
                        הורד את כל {originalImages.length + bgReplacedImages.length} התמונות
                    </Button>
                </div>
            )}

            {/* Original Images Gallery */}
            {originalImages.length > 0 && (
                <ImageGrid
                    images={originalImages}
                    prefix="original"
                    title="תמונות מקוריות"
                    titleIcon={<CheckCircle className="h-5 w-5 text-green-500" />}
                />
            )}

            {/* Background-Replaced Images Gallery */}
            {bgReplacedImages.length > 0 && (
                <ImageGrid
                    images={bgReplacedImages}
                    prefix="new-background"
                    title="תמונות עם רקע חדש"
                    titleIcon={<ImageIcon className="h-5 w-5 text-purple-500" />}
                    borderColor="border-purple-200"
                />
            )}

            {/* Tips */}
            {!loading && !hasResults && (
                <Card className="bg-blue-50 border-blue-100">
                    <CardContent className="p-6">
                        <h3 className="font-medium mb-2">MediaPipe AI — איך זה עובד?</h3>
                        <ul className="text-sm text-gray-600 space-y-1">
                            <li><strong>1. תמונות מקוריות</strong> — הפריימים החדים ביותר (עם העדפה לכאלה שמכילים אדם)</li>
                            <li><strong>2. החלפת רקע</strong> — אותן תמונות עם הרקע שבחרת, קצוות חלקים וטבעיים</li>
                            <li><strong>3. איכות קצוות</strong> — Gaussian blur + Smoothstep על מסיכת הסגמנטציה</li>
                            <li>• כל העיבוד בדפדפן — מהיר ופרטי | עד 100MB</li>
                        </ul>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
