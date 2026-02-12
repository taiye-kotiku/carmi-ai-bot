"use client";

import { useState } from "react";
import { Film, Download, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { isValidInstagramUrl } from "@/lib/utils";
import { useNotifications } from "@/lib/notifications/notification-context";

interface Frame {
    url: string;
    timestamp: number;
}

export default function ReelConverterPage() {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState("");
    const [frames, setFrames] = useState<Frame[]>([]);
    const [error, setError] = useState<string | null>(null);

    const { addGenerationNotification } = useNotifications();

    const handleConvert = async () => {
        if (!isValidInstagramUrl(url)) {
            toast.error("נא להזין קישור תקין לרילז מאינסטגרם");
            return;
        }

        setLoading(true);
        setProgress(0);
        setError(null);
        setFrames([]);

        try {
            setProgressText("מתחיל המרה...");
            setProgress(10);

            const response = await fetch("/api/generate/reel", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "שגיאה בהמרה");
            }

            const { jobId } = await response.json();
            setProgress(20);
            setProgressText("מוריד וידאו...");

            let attempts = 0;
            const maxAttempts = 60;

            while (attempts < maxAttempts) {
                await new Promise((resolve) => setTimeout(resolve, 2000));

                const statusResponse = await fetch(`/api/jobs/${jobId}`);
                const status = await statusResponse.json();

                if (status.status === "completed") {
                    setProgress(100);
                    setProgressText("הושלם!");
                    setFrames(status.result.frames);
                    toast.success("!הקרוסלה מוכנה 🎉");
                    addGenerationNotification("reel", status.result.frames?.length);
                    break;
                }

                if (status.status === "failed") {
                    throw new Error(status.error || "ההמרה נכשלה");
                }

                if (status.progress) {
                    setProgress(20 + status.progress * 0.8);
                }

                if (status.progress < 30) {
                    setProgressText("מוריד וידאו...");
                } else if (status.progress < 60) {
                    setProgressText("מחלץ פריימים...");
                } else if (status.progress < 90) {
                    setProgressText("בוחר את התמונות הטובות...");
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

    const downloadFrame = async (frame: Frame, index: number) => {
        try {
            const response = await fetch(frame.url);
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = `carousel-frame-${index + 1}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
            toast.success(`!פריים ${index + 1} הורד`);
        } catch {
            toast.error("שגיאה בהורדה");
        }
    };

    const downloadAll = async () => {
        toast.info("מוריד את כל התמונות...");
        for (let i = 0; i < frames.length; i++) {
            await downloadFrame(frames[i], i);
            await new Promise((r) => setTimeout(r, 500));
        }
        toast.success("!כל התמונות הורדו");
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
                            <h1 className="text-2xl font-bold">המרת רילז לקרוסלה</h1>
                            <Badge variant="warning">⭐ הכי פופולרי</Badge>
                        </div>
                        <p className="text-gray-600">הדבק קישור לרילז מאינסטגרם וקבל 10 תמונות מושלמות</p>
                    </div>
                </div>
            </div>

            <Card className="mb-8">
                <CardContent className="p-6">
                    <label className="block text-sm font-medium mb-2">קישור לרילז</label>
                    <div className="flex gap-3">
                        <Input type="url" placeholder="https://www.instagram.com/reel/ABC123..." value={url} onChange={(e) => setUrl(e.target.value)} disabled={loading} className="flex-1 text-left" dir="ltr" />
                        <Button onClick={handleConvert} disabled={!url || loading} size="lg">
                            {loading ? (<><Loader2 className="h-4 w-4 animate-spin ml-2" />ממיר...</>) : ("המר לקרוסלה")}
                        </Button>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                        <p className="text-sm text-gray-500">✓ עובד עם רילז ופוסטים ציבוריים</p>
                        <p className="text-sm text-primary font-medium">עלות: 1 קרדיט רילז → 10 תמונות</p>
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
                        <div className="flex items-center gap-3 text-red-700"><AlertCircle className="h-5 w-5" /><span>{error}</span></div>
                    </CardContent>
                </Card>
            )}

            {frames.length > 0 && (
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <CheckCircle className="h-5 w-5 text-green-500" />
                                <h2 className="text-lg font-semibold">הקרוסלה שלך מוכנה! ({frames.length} תמונות)</h2>
                            </div>
                            <Button onClick={downloadAll} variant="outline"><Download className="h-4 w-4 ml-2" />הורד הכל</Button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {frames.map((frame, index) => (
                                <div key={index} className="relative group aspect-square rounded-lg overflow-hidden border bg-gray-100">
                                    <img src={frame.url} alt={`Frame ${index + 1}`} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Button size="sm" variant="secondary" onClick={() => downloadFrame(frame, index)}><Download className="h-4 w-4" /></Button>
                                    </div>
                                    <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">{index + 1}/{frames.length}</div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {!loading && frames.length === 0 && (
                <Card className="bg-blue-50 border-blue-100">
                    <CardContent className="p-6">
                        <h3 className="font-medium mb-2">💡 טיפים</h3>
                        <ul className="text-sm text-gray-600 space-y-1">
                            <li>• וודא שהרילז הוא ציבורי (לא מחשבון פרטי)</li>
                            <li>• העתק את הקישור המלא מאפליקציית אינסטגרם</li>
                            <li>• ההמרה לוקחת בין 30 שניות ל-2 דקות</li>
                        </ul>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}