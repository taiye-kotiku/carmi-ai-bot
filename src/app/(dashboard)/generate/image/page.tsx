"use client";

import { useState, useRef } from "react";
import { Sparkles, Download, Loader2, Wand2, Upload, X, ImageIcon, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useNotifications } from "@/lib/notifications/notification-context";
import { CREDIT_COSTS } from "@/lib/config/credits";

const ASPECT_RATIOS = [
    { value: "1:1", label: "ריבועי (1:1)", icon: "⬜" },
    { value: "16:9", label: "רחב (16:9)", icon: "🖼️" },
    { value: "9:16", label: "סטורי (9:16)", icon: "📱" },
    { value: "4:3", label: "קלאסי (4:3)", icon: "📺" },
];

const STYLES = [
    { value: "realistic", label: "ריאליסטי", icon: "📷" },
    { value: "artistic", label: "אמנותי", icon: "🎨" },
    { value: "cartoon", label: "קריקטורה", icon: "🖌️" },
    { value: "minimal", label: "מינימליסטי", icon: "◻️" },
];

type Mode = "create" | "edit";

/** Resize an image file to max dimension, return base64 data URL */
function resizeImage(file: File, maxDim = 1024): Promise<{ base64: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                if (width > maxDim || height > maxDim) {
                    const scale = maxDim / Math.max(width, height);
                    width = Math.round(width * scale);
                    height = Math.round(height * scale);
                }
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d")!;
                ctx.drawImage(img, 0, 0, width, height);
                const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
                const quality = mimeType === "image/jpeg" ? 0.85 : undefined;
                const dataUrl = canvas.toDataURL(mimeType, quality);
                // Strip the data:...;base64, prefix
                const base64 = dataUrl.split(",")[1];
                resolve({ base64, mimeType });
            };
            img.onerror = () => reject(new Error("Failed to load image"));
            img.src = reader.result as string;
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
    });
}

export default function ImageGenerationPage() {
    const [mode, setMode] = useState<Mode>("create");
    const [prompt, setPrompt] = useState("");
    const [aspectRatio, setAspectRatio] = useState("1:1");
    const [style, setStyle] = useState("realistic");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string | null>(null);

    // Image edit state
    const [sourceImage, setSourceImage] = useState<File | null>(null);
    const [sourcePreview, setSourcePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { addGenerationNotification } = useNotifications();

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            toast.error("נא להעלות קובץ תמונה בלבד");
            return;
        }
        if (file.size > 20 * 1024 * 1024) {
            toast.error("גודל הקובץ חייב להיות עד 20MB");
            return;
        }
        setSourceImage(file);
        setSourcePreview(URL.createObjectURL(file));
    };

    const clearSourceImage = () => {
        setSourceImage(null);
        if (sourcePreview) URL.revokeObjectURL(sourcePreview);
        setSourcePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            toast.error("נא להזין תיאור לתמונה");
            return;
        }
        if (mode === "edit" && !sourceImage) {
            toast.error("נא להעלות תמונה לעריכה");
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            // Build request body
            const body: Record<string, string> = { prompt, aspectRatio, style };

            if (mode === "edit" && sourceImage) {
                const { base64, mimeType } = await resizeImage(sourceImage);
                body.imageBase64 = base64;
                body.imageMimeType = mimeType;
            }

            const response = await fetch("/api/generate/image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error);
            }

            const { jobId } = await response.json();

            // Poll for result
            let attempts = 0;
            while (attempts < 30) {
                await new Promise((r) => setTimeout(r, 2000));

                const statusRes = await fetch(`/api/jobs/${jobId}`);
                const status = await statusRes.json();

                if (status.status === "completed") {
                    setResult(status.result.url);
                    toast.success(mode === "edit" ? "!התמונה נערכה בהצלחה" : "!התמונה נוצרה 🎨");
                    addGenerationNotification("image");
                    break;
                }

                if (status.status === "failed") {
                    throw new Error(status.error);
                }

                attempts++;
            }
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async () => {
        if (!result) return;

        try {
            const response = await fetch(result);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = mode === "edit" ? "edited-image.png" : "generated-image.png";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            toast.success("!התמונה הורדה");
        } catch {
            toast.error("שגיאה בהורדה");
        }
    };

    return (
        <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="h-12 w-12 bg-purple-100 rounded-xl flex items-center justify-center">
                        <Sparkles className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">
                            {mode === "edit" ? "עריכת תמונה" : "יצירת תמונה"}
                        </h1>
                        <p className="text-gray-600">
                            {mode === "edit"
                                ? "העלה תמונה ותאר מה לשנות — הבינה המלאכותית תערוך אותה"
                                : "תאר את התמונה שאתה רוצה והבינה המלאכותית תיצור אותה"}
                        </p>
                    </div>
                </div>
            </div>

            {/* Mode Toggle */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => { setMode("create"); clearSourceImage(); }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        mode === "create"
                            ? "bg-purple-600 text-white shadow-md"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                >
                    <ImageIcon className="h-4 w-4" />
                    יצירה חדשה
                </button>
                <button
                    onClick={() => setMode("edit")}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        mode === "edit"
                            ? "bg-purple-600 text-white shadow-md"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                >
                    <PenLine className="h-4 w-4" />
                    עריכת תמונה
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Input Column */}
                <div className="space-y-6">
                    <Card>
                        <CardContent className="p-6 space-y-6">
                            {/* Image Upload (edit mode only) */}
                            {mode === "edit" && (
                                <div>
                                    <Label className="text-base">תמונת מקור</Label>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageChange}
                                        disabled={loading}
                                        className="hidden"
                                    />
                                    {!sourceImage ? (
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={loading}
                                            className="mt-2 w-full border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-purple-400 hover:bg-purple-50/50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Upload className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                                            <p className="text-sm font-medium text-gray-700">לחץ להעלאת תמונה</p>
                                            <p className="text-xs text-gray-500 mt-1">JPG, PNG, WebP — עד 20MB</p>
                                        </button>
                                    ) : (
                                        <div className="mt-2 relative rounded-xl overflow-hidden border border-purple-200">
                                            <img
                                                src={sourcePreview!}
                                                alt="Source"
                                                className="w-full max-h-[240px] object-contain bg-gray-50"
                                            />
                                            <button
                                                onClick={clearSourceImage}
                                                disabled={loading}
                                                className="absolute top-2 left-2 p-1.5 bg-white/90 rounded-full shadow hover:bg-red-50 transition-colors"
                                            >
                                                <X className="h-4 w-4 text-gray-600" />
                                            </button>
                                            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-3 py-1.5 truncate">
                                                {sourceImage.name} — {(sourceImage.size / (1024 * 1024)).toFixed(1)} MB
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div>
                                <Label htmlFor="prompt" className="text-base">
                                    {mode === "edit" ? "מה לשנות בתמונה?" : "תיאור התמונה"}
                                </Label>
                                <Textarea
                                    id="prompt"
                                    placeholder={
                                        mode === "edit"
                                            ? "לדוגמה: שנה את הרקע לחוף ים, הוסף משקפי שמש, הפוך לציור שמן..."
                                            : "לדוגמה: חתול כתום יושב על ספה כחולה, אור חם של שקיעה נכנס מהחלון..."
                                    }
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    rows={4}
                                    className="mt-2"
                                />
                                <p className="text-sm text-gray-500 mt-1">
                                    {mode === "edit"
                                        ? "תאר את השינויים שתרצה לבצע בתמונה"
                                        : "ככל שהתיאור מפורט יותר, התוצאה תהיה טובה יותר"}
                                </p>
                            </div>

                            {/* Aspect ratio only for creation mode */}
                            {mode === "create" && (
                                <div>
                                    <Label className="text-base">יחס תמונה</Label>
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        {ASPECT_RATIOS.map((ratio) => (
                                            <button
                                                key={ratio.value}
                                                onClick={() => setAspectRatio(ratio.value)}
                                                className={`p-3 rounded-lg border text-sm flex items-center gap-2 transition-colors ${aspectRatio === ratio.value
                                                    ? "border-primary bg-primary/5 text-primary"
                                                    : "border-gray-200 hover:border-gray-300"
                                                    }`}
                                            >
                                                <span>{ratio.icon}</span>
                                                <span>{ratio.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <Label className="text-base">סגנון</Label>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    {STYLES.map((s) => (
                                        <button
                                            key={s.value}
                                            onClick={() => setStyle(s.value)}
                                            className={`p-3 rounded-lg border text-sm flex items-center gap-2 transition-colors ${style === s.value
                                                ? "border-primary bg-primary/5 text-primary"
                                                : "border-gray-200 hover:border-gray-300"
                                                }`}
                                        >
                                            <span>{s.icon}</span>
                                            <span>{s.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <Button
                                onClick={handleGenerate}
                                disabled={loading || !prompt.trim() || (mode === "edit" && !sourceImage)}
                                className="w-full"
                                size="lg"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin ml-2" />
                                        {mode === "edit" ? "עורך תמונה..." : "יוצר תמונה..."}
                                    </>
                                ) : (
                                    <>
                                        <Wand2 className="h-5 w-5 ml-2" />
                                        {mode === "edit" ? "ערוך תמונה" : "צור תמונה"}
                                    </>
                                )}
                            </Button>

                            <p className="text-sm text-primary text-center">
                                עלות: {CREDIT_COSTS.image_generation} קרדיטים
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Result Column */}
                <div>
                    <Card className="h-full">
                        <CardContent className="p-6 h-full flex flex-col">
                            <h3 className="text-lg font-medium mb-4">תוצאה</h3>

                            {loading && (
                                <div className="flex-1 bg-gray-100 rounded-lg flex items-center justify-center min-h-[400px]">
                                    <div className="text-center">
                                        <Loader2 className="h-12 w-12 animate-spin text-gray-400 mx-auto mb-4" />
                                        <p className="text-gray-500">
                                            {mode === "edit" ? "עורך את התמונה שלך..." : "יוצר את התמונה שלך..."}
                                        </p>
                                        <p className="text-sm text-gray-400 mt-1">
                                            זה יכול לקחת עד 30 שניות
                                        </p>
                                    </div>
                                </div>
                            )}

                            {result && !loading && (
                                <div className="space-y-4">
                                    <img
                                        src={result}
                                        alt="Generated"
                                        className="w-full rounded-lg border"
                                    />
                                    <Button variant="outline" className="w-full" onClick={handleDownload}>
                                        <Download className="h-4 w-4 ml-2" />
                                        הורד תמונה
                                    </Button>
                                </div>
                            )}

                            {!loading && !result && (
                                <div className="flex-1 bg-gray-50 rounded-lg flex items-center justify-center border-2 border-dashed min-h-[400px]">
                                    <div className="text-center text-gray-400">
                                        <Sparkles className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                        <p>התמונה תופיע כאן</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
