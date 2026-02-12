"use client";

import { useState } from "react";
import { Sparkles, Download, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useNotifications } from "@/lib/notifications/notification-context";

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

export default function ImageGenerationPage() {
    const [prompt, setPrompt] = useState("");
    const [aspectRatio, setAspectRatio] = useState("1:1");
    const [style, setStyle] = useState("realistic");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string | null>(null);

    const { addGenerationNotification } = useNotifications();

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            toast.error("נא להזין תיאור לתמונה");
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const response = await fetch("/api/generate/image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt, aspectRatio, style }),
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
                    toast.success("!התמונה נוצרה 🎨");
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
            a.download = "generated-image.png";
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
                        <h1 className="text-2xl font-bold">יצירת תמונה</h1>
                        <p className="text-gray-600">
                            תאר את התמונה שאתה רוצה והבינה המלאכותית תיצור אותה
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Input Column */}
                <div className="space-y-6">
                    <Card>
                        <CardContent className="p-6 space-y-6">
                            <div>
                                <Label htmlFor="prompt" className="text-base">
                                    תיאור התמונה
                                </Label>
                                <Textarea
                                    id="prompt"
                                    placeholder="לדוגמה: חתול כתום יושב על ספה כחולה, אור חם של שקיעה נכנס מהחלון..."
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    rows={4}
                                    className="mt-2"
                                />
                                <p className="text-sm text-gray-500 mt-1">
                                    ככל שהתיאור מפורט יותר, התוצאה תהיה טובה יותר
                                </p>
                            </div>

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
                                disabled={loading || !prompt.trim()}
                                className="w-full"
                                size="lg"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin ml-2" />
                                        יוצר תמונה...
                                    </>
                                ) : (
                                    <>
                                        <Wand2 className="h-5 w-5 ml-2" />
                                        צור תמונה
                                    </>
                                )}
                            </Button>

                            <p className="text-sm text-primary text-center">
                                עלות: 1 קרדיט תמונה
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
                                        <p className="text-gray-500">יוצר את התמונה שלך...</p>
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