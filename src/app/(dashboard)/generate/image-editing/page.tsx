"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Download, Image as ImageIcon, Sparkles, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useNotifications } from "@/lib/notifications/notification-context";
import { ExportFormats } from "@/components/export-formats";
import { CREDIT_COSTS } from "@/lib/config/credits";

type EditMode = "prompt" | "celebrity" | "combine";

export default function ImageEditingPage() {
    const [mode, setMode] = useState<EditMode>("prompt");
    const [editStyle, setEditStyle] = useState<"realistic" | "artistic" | "cartoon">("realistic");
    const [prompt, setPrompt] = useState("");
    const [celebrityName, setCelebrityName] = useState("");
    const [uploadedImage, setUploadedImage] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [uploadedImage2, setUploadedImage2] = useState<File | null>(null);
    const [previewUrl2, setPreviewUrl2] = useState<string | null>(null);

    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState("");
    const [result, setResult] = useState<string | null>(null);
    const [resultLoadError, setResultLoadError] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef2 = useRef<HTMLInputElement>(null);
    const pollRef = useRef<NodeJS.Timeout | null>(null);
    const isCompletedRef = useRef(false);

    const { addGenerationNotification } = useNotifications();

    const stopPolling = useCallback(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }, []);

    const pollJob = useCallback((jobId: string) => {
        isCompletedRef.current = false;
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch(`/api/jobs/${jobId}`);
                let data: { status?: string; progress?: number; result?: { url?: string; imageUrl?: string }; error?: string };
                try {
                    data = await res.json();
                } catch {
                    return;
                }

                if (data.progress) setProgress(data.progress);

                if (data.status === "completed") {
                    if (isCompletedRef.current) return;
                    isCompletedRef.current = true;
                    stopPolling();
                    const imageUrl = data.result?.url || data.result?.imageUrl;
                    if (imageUrl) {
                        setResult(imageUrl);
                        setProgress(100);
                        setStatusText("התמונה מוכנה!");
                        toast.success("התמונה נוצרה בהצלחה!");
                        addGenerationNotification("image");
                    } else {
                        toast.error("לא התקבלה תמונה בתוצאה");
                    }
                    setIsGenerating(false);
                } else if (data.status === "failed") {
                    if (isCompletedRef.current) return;
                    isCompletedRef.current = true;
                    stopPolling();
                    toast.error(data.error || "עריכת התמונה נכשלה");
                    setIsGenerating(false);
                    setProgress(0);
                } else {
                    const p = data.progress ?? 0;
                    if (p < 30) setStatusText("מתחיל עריכה...");
                    else if (p < 60) setStatusText("מעבד תמונה...");
                    else if (p < 90) setStatusText("משפר איכות...");
                    else setStatusText("שומר לקובץ...");
                }
            } catch (err) {
                console.error("Poll error:", err);
            }
        }, 2000);
    }, [stopPolling, addGenerationNotification]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast.error("הקובץ גדול מדי (מקסימום 5MB)");
                return;
            }
            setUploadedImage(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const clearImage = () => {
        setUploadedImage(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleImageUpload2 = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast.error("הקובץ גדול מדי (מקסימום 5MB)");
                return;
            }
            setUploadedImage2(file);
            setPreviewUrl2(URL.createObjectURL(file));
        }
    };

    const clearImage2 = () => {
        setUploadedImage2(null);
        if (previewUrl2) URL.revokeObjectURL(previewUrl2);
        setPreviewUrl2(null);
        if (fileInputRef2.current) fileInputRef2.current.value = "";
    };

    const resetForMode = (newMode: EditMode) => {
        setMode(newMode);
        setPrompt("");
        setCelebrityName("");
        clearImage2();
        setResult(null);
    };

    const handleGenerate = async () => {
        if (!uploadedImage) {
            toast.error("נא להעלות תמונה");
            return;
        }

        let finalPrompt = prompt.trim();
        let style: string;
        let useImage2 = false;

        if (mode === "prompt") {
            style = editStyle;
            if (!finalPrompt) {
                toast.error("נא להזין הוראות עריכה");
                return;
            }
        } else if (mode === "celebrity") {
            if (uploadedImage2) {
                style = "combine_images";
                useImage2 = true;
                finalPrompt = finalPrompt || "שלב את שתי הדמויות באותה סצנה";
            } else {
                style = "celebrity";
                finalPrompt = celebrityName.trim()
                    ? `${celebrityName.trim()} - ${finalPrompt || "באותו סצנה"}`
                    : finalPrompt || "שלב את הדמות מהתמונה";
            }
        } else {
            style = "combine_images";
            useImage2 = true;
            if (!uploadedImage2) {
                toast.error("נא להעלות שתי תמונות (אדם + דמות)");
                return;
            }
            if (!finalPrompt) {
                toast.error("נא להזין תיאור לסצנה/שילוב");
                return;
            }
        }

        setIsGenerating(true);
        setProgress(5);
        setResult(null);
        setResultLoadError(false);
        setStatusText("שולח בקשה...");

        try {
            const body: any = {
                prompt: finalPrompt,
                aspectRatio: "1:1",
                style,
                imageBase64: null as string | null,
                imageMimeType: null as string | null,
                imageBase642: null as string | null,
                imageMimeType2: null as string | null,
            };

            const buffer = await uploadedImage.arrayBuffer();
            body.imageBase64 = Buffer.from(buffer).toString("base64");
            body.imageMimeType = uploadedImage.type;

            if (useImage2 && uploadedImage2) {
                const buffer2 = await uploadedImage2.arrayBuffer();
                body.imageBase642 = Buffer.from(buffer2).toString("base64");
                body.imageMimeType2 = uploadedImage2.type;
            }

            const response = await fetch("/api/generate/image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            let data: { jobId?: string; error?: string };
            try {
                const text = await response.text();
                data = text ? JSON.parse(text) : {};
            } catch {
                throw new Error(response.status === 413
                    ? "הנתונים גדולים מדי. נא להקטין את גודל התמונות."
                    : `שגיאת שרת (${response.status}). נא לנסות שוב.`);
            }

            if (!response.ok) {
                throw new Error(data.error || "שגיאה בעריכת התמונה");
            }

            if (data.jobId) {
                setProgress(10);
                setStatusText("הבקשה התקבלה...");
                pollJob(data.jobId);
            } else {
                throw new Error("לא התקבל מזהה עבודה");
            }
        } catch (err: any) {
            console.error("Generate error:", err);
            toast.error(err.message);
            setIsGenerating(false);
        }
    };

    const modes: { value: EditMode; label: string; desc: string }[] = [
        { value: "prompt", label: "עריכה לפי פרומפט", desc: "העלה תמונה וערוך אותה לפי הוראות טקסט" },
        { value: "celebrity", label: "עם סלבריטאי (לפי שם או תמונה)", desc: "שלב את התמונה עם סלבריטאי לפי שם או העלאת תמונה" },
        { value: "combine", label: "שילוב 2 תמונות", desc: "העלה תמונת אדם ותמונת דמות - השילוב לפי הפרומפט שלך" },
    ];

    return (
        <div className="container mx-auto py-8 px-4" dir="rtl">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                        <ImageIcon className="h-8 w-8 text-purple-500" />
                        עריכת תמונה
                    </h1>
                    <p className="text-gray-600">
                        העלה תמונה ובחר אופן העריכה: לפי פרומפט, עם סלבריטאי, או שילוב שתי תמונות
                    </p>
                </div>

                <div className="grid lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>בחר סוג עריכה</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    {modes.map((m) => (
                                        <button
                                            key={m.value}
                                            type="button"
                                            onClick={() => resetForMode(m.value)}
                                            disabled={isGenerating}
                                            className={`w-full text-right p-4 rounded-xl border-2 transition-all ${
                                                mode === m.value
                                                    ? "border-purple-500 bg-purple-50"
                                                    : "border-gray-200 hover:border-gray-300"
                                            }`}
                                        >
                                            <span className="font-medium block">{m.label}</span>
                                            <span className="text-sm text-gray-500">{m.desc}</span>
                                        </button>
                                    ))}
                                </div>

                                <div className="space-y-2">
                                    <Label>תמונת מקור (חובה)</Label>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isGenerating}
                                        className="w-full"
                                    >
                                        <Upload className="ml-2 h-4 w-4" />
                                        העלה תמונה
                                    </Button>
                                    {previewUrl && (
                                        <div className="relative w-24 h-24 mt-2">
                                            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover rounded-md border" />
                                            <button
                                                onClick={clearImage}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600"
                                                disabled={isGenerating}
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {mode === "celebrity" && (
                                    <>
                                        <div className="space-y-2">
                                            <Label>שם סלבריטאי (אופציונלי - או העלה תמונה למטה)</Label>
                                            <Input
                                                placeholder="לדוגמה: בראד פיט, טיילור סוויפט"
                                                value={celebrityName}
                                                onChange={(e) => setCelebrityName(e.target.value)}
                                                disabled={isGenerating}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>תמונת סלבריטאי/דמות (אופציונלי - במקום שם)</Label>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => fileInputRef2.current?.click()}
                                                disabled={isGenerating}
                                                className="w-full"
                                            >
                                                <Upload className="ml-2 h-4 w-4" />
                                                העלה תמונת סלבריטאי
                                            </Button>
                                            {previewUrl2 && (
                                                <div className="relative w-24 h-24 mt-2">
                                                    <img src={previewUrl2} alt="Preview 2" className="w-full h-full object-cover rounded-md border" />
                                                    <button
                                                        onClick={clearImage2}
                                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600"
                                                        disabled={isGenerating}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}

                                {mode === "combine" && (
                                    <div className="space-y-2">
                                        <Label>תמונת דמות (תמונה 2)</Label>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => fileInputRef2.current?.click()}
                                            disabled={isGenerating}
                                            className="w-full"
                                        >
                                            <Upload className="ml-2 h-4 w-4" />
                                            העלה תמונת דמות
                                        </Button>
                                        {previewUrl2 && (
                                            <div className="relative w-24 h-24 mt-2">
                                                <img src={previewUrl2} alt="Preview 2" className="w-full h-full object-cover rounded-md border" />
                                                <button
                                                    onClick={clearImage2}
                                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600"
                                                    disabled={isGenerating}
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <input
                                    type="file"
                                    ref={fileInputRef2}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleImageUpload2}
                                />

                                {mode === "prompt" && (
                                    <div className="space-y-2">
                                        <Label>סגנון עריכה</Label>
                                        <div className="flex gap-2">
                                            {(["realistic", "artistic", "cartoon"] as const).map((s) => (
                                                <button
                                                    key={s}
                                                    type="button"
                                                    onClick={() => setEditStyle(s)}
                                                    disabled={isGenerating}
                                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                        editStyle === s
                                                            ? "bg-purple-600 text-white"
                                                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                                    }`}
                                                >
                                                    {s === "realistic" ? "פוטוריאליסטי" : s === "artistic" ? "אמנותי" : "קריקטורה"}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label>
                                        {mode === "prompt"
                                            ? "הוראות עריכה"
                                            : mode === "celebrity"
                                              ? "תיאור הסצנה (אופציונלי)"
                                              : "תיאור הסצנה/שילוב"}
                                    </Label>
                                    <Textarea
                                        placeholder={
                                            mode === "prompt"
                                                ? "לדוגמה: הוסף רקע של חוף ים, שנה את התאורה..."
                                                : mode === "celebrity"
                                                  ? "לדוגמה: שניהם בטקס אוסקר, מפגש בקפה..."
                                                  : "לדוגמה: שניהם בטקס אוסקר, מפגש בקפה, אותו רקע..."
                                        }
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        rows={3}
                                        disabled={isGenerating}
                                    />
                                </div>

                                <Button
                                    onClick={handleGenerate}
                                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                                    size="lg"
                                    disabled={isGenerating || !uploadedImage}
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                                            מעבד...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="ml-2 h-5 w-5" />
                                            ערוך תמונה ({CREDIT_COSTS.image_generation} קרדיטים)
                                        </>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <Card className="h-full min-h-[400px] flex flex-col">
                            <CardHeader>
                                <CardTitle>תוצאה</CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col items-center justify-center p-6 bg-gray-50/50">
                                {isGenerating ? (
                                    <div className="text-center space-y-4">
                                        <Loader2 className="w-20 h-20 animate-spin text-purple-500/30 mx-auto" />
                                        <p className="text-sm text-gray-500 font-medium">{statusText}</p>
                                        <p className="text-xs text-gray-400">{Math.round(progress)}%</p>
                                    </div>
                                ) : result ? (
                                    <div className="w-full space-y-4">
                                        {resultLoadError ? (
                                            <div className="p-4 bg-amber-50 text-amber-800 rounded-lg text-sm">
                                                התמונה לא נטענה.{" "}
                                                <a href={result} target="_blank" rel="noopener noreferrer" className="underline">לחץ לפתיחה</a>
                                            </div>
                                        ) : (
                                            <img
                                                src={result}
                                                alt="Result"
                                                className="w-full h-auto object-contain max-h-[500px] rounded-lg border"
                                                referrerPolicy="no-referrer"
                                                onError={() => setResultLoadError(true)}
                                            />
                                        )}
                                        <ExportFormats imageUrl={result} baseFilename="edited-image" />
                                    </div>
                                ) : (
                                    <div className="text-center text-gray-400">
                                        <ImageIcon className="h-16 w-16 mx-auto mb-4 opacity-20" />
                                        <p>התמונה המעובדת תופיע כאן</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
