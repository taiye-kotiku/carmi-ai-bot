"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, Image as ImageIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useNotifications } from "@/lib/notifications/notification-context";
import { ExportFormats } from "@/components/export-formats";
import { InstagramPreview } from "@/components/instagram-preview";
import { CREDIT_COSTS } from "@/lib/config/credits";

export default function TextToImagePage() {
    const [prompt, setPrompt] = useState("");
    const [style, setStyle] = useState("realistic");
    const [aspectRatio, setAspectRatio] = useState("1:1");
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState("");
    const [result, setResult] = useState<string | null>(null);
    const [resultLoadError, setResultLoadError] = useState(false);
    const pollRef = useRef<NodeJS.Timeout | null>(null);
    const isCompletedRef = useRef(false);

    const { addGenerationNotification } = useNotifications();

    // Styles configuration (text-to-image only)
    const styles = [
        { value: "realistic", label: "פוטוריאליסטי (מציאותי)" },
        { value: "artistic", label: "אמנותי (ציור)" },
        { value: "cartoon", label: "קריקטורה / אנימציה" },
    ];

    const aspectRatios = [
        { value: "1:1", label: "1:1 (ריבוע - אינסטגרם)" },
        { value: "16:9", label: "16:9 (רוחבי - יוטיוב)" },
        { value: "9:16", label: "9:16 (סטורי / רילס)" },
        { value: "4:3", label: "4:3 (רגיל)" },
    ];

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

                if (data.progress) {
                    setProgress(data.progress);
                }

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
                    toast.error(data.error || "יצירת התמונה נכשלה");
                    setIsGenerating(false);
                    setProgress(0);
                } else {
                    // Update status text based on progress
                    const p = data.progress ?? 0;
                    if (p < 30) setStatusText("מתחיל יצירה...");
                    else if (p < 60) setStatusText("מעבד תמונה...");
                    else if (p < 90) setStatusText("משפר איכות...");
                    else setStatusText("שומר לקובץ...");
                }
            } catch (err) {
                console.error("Poll error:", err);
            }
        }, 2000); // Check every 2 seconds
    }, [stopPolling, addGenerationNotification]);

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            toast.error("נא להזין תיאור לתמונה");
            return;
        }

        setIsGenerating(true);
        setProgress(5);
        setResult(null);
        setResultLoadError(false);
        setStatusText("שולח בקשה...");

        try {
            // Prepare payload (text-to-image only - no edit/combine)
            const body: any = {
                prompt,
                style,
                aspectRatio,
            };

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
                throw new Error(data.error || "שגיאה ביצירת התמונה");
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

    return (
        <div className="container mx-auto py-8 px-4" dir="rtl">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                        <ImageIcon className="h-8 w-8 text-purple-500" />
                        יצירת תמונה (Text to Image)
                    </h1>
                    <p className="text-gray-600">
                        כתוב תיאור, בחר סגנון וצור תמונות מרהיבות בעזרת AI
                    </p>
                </div>

                <div className="grid lg:grid-cols-2 gap-8">
                    {/* Controls */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>הגדרות יצירה</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>תיאור התמונה (Prompt)</Label>
                                    <Textarea
                                        placeholder="לדוגמה: חתול ג'ינג'י חמוד עם משקפי שמש יושב על חוף הים בשקיעה..."
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        rows={4}
                                        disabled={isGenerating}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>סגנון</Label>
                                        <Select value={style} onValueChange={setStyle} disabled={isGenerating}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {styles.map((s) => (
                                                    <SelectItem key={s.value} value={s.value}>
                                                        {s.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>יחס גובה-רוחב</Label>
                                        <Select value={aspectRatio} onValueChange={setAspectRatio} disabled={isGenerating}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {aspectRatios.map((r) => (
                                                    <SelectItem key={r.value} value={r.value}>
                                                        {r.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <Button
                                        onClick={handleGenerate}
                                        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                                        size="lg"
                                        disabled={isGenerating || !prompt.trim()}
                                    >
                                        {isGenerating ? (
                                            <>
                                                <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                                                מייצר...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="ml-2 h-5 w-5" />
                                                צור תמונה ({CREDIT_COSTS.image_generation} קרדיטים)
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Result Preview */}
                    <div className="space-y-6">
                        <Card className="h-full min-h-[400px] flex flex-col">
                            <CardHeader>
                                <CardTitle>תוצאה</CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col items-center justify-center p-6 bg-gray-50/50">
                                {isGenerating ? (
                                    <div className="text-center space-y-4">
                                        <div className="relative w-20 h-20 mx-auto">
                                            <Loader2 className="w-20 h-20 animate-spin text-purple-500/30" />
                                            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-purple-600">
                                                {Math.round(progress)}%
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-500 font-medium animate-pulse">
                                            {statusText}
                                        </p>
                                    </div>
                                ) : result ? (
                                    <div className="w-full space-y-4">
                                        <div className="relative rounded-lg overflow-hidden border border-gray-200 shadow-sm group">
                                            {resultLoadError ? (
                                                <div className="p-4 bg-amber-50 text-amber-800 rounded-lg text-sm">
                                                    התמונה לא נטענה.{" "}
                                                    <a href={result} target="_blank" rel="noopener noreferrer" className="underline">
                                                        לחץ לפתיחה בחלון חדש
                                                    </a>
                                                </div>
                                            ) : (
                                                <img
                                                    src={result}
                                                    alt="Generated Result"
                                                    className="w-full h-auto object-contain max-h-[500px]"
                                                    referrerPolicy="no-referrer"
                                                    onError={() => setResultLoadError(true)}
                                                />
                                            )}
                                        </div>
                                        {/* Instagram-style preview - how it looks in feed */}
                                        {!resultLoadError && (
                                            <div className="pt-4 border-t">
                                                <p className="text-sm text-gray-500 mb-3 text-center">איך זה ייראה באינסטגרם</p>
                                                <InstagramPreview imageUrl={result} aspectRatio={aspectRatio} />
                                            </div>
                                        )}
                                        <ExportFormats imageUrl={result} baseFilename="generated-image" />
                                    </div>
                                ) : (
                                    <div className="text-center space-y-4">
                                        <div className="text-gray-400">
                                            <ImageIcon className="h-16 w-16 mx-auto mb-4 opacity-20" />
                                            <p>התמונה שתיצור תופיע כאן</p>
                                        </div>
                                        <p className="text-sm text-gray-500">תצוגה מקדימה – איך זה ייראה באינסטגרם</p>
                                        <InstagramPreview imageUrl={null} aspectRatio={aspectRatio} />
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