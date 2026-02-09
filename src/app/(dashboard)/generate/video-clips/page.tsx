// src/app/(dashboard)/generate/video-clips/page.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CLIP_LENGTHS = [
    { value: [2, 3], label: "30-90 שניות", description: "מומלץ לשורטס" },
    { value: [1, 2], label: "עד 60 שניות", description: "קליפים קצרים" },
    { value: [3, 4], label: "60 שניות - 3 דקות", description: "קליפים ארוכים" },
    { value: [0], label: "אוטומטי", description: "תן ל-AI להחליט" },
];

const ASPECT_RATIOS = [
    { value: 1, label: "9:16 אנכי", description: "TikTok, Reels, Shorts", icon: "📱" },
    { value: 2, label: "1:1 ריבוע", description: "Instagram Feed", icon: "⬜" },
    { value: 3, label: "4:5 פורטרט", description: "Instagram Feed מותאם", icon: "📷" },
    { value: 4, label: "16:9 אופקי", description: "YouTube, LinkedIn", icon: "🖥️" },
];

const LANGUAGES = [
    { value: "auto", label: "זיהוי אוטומטי" },
    { value: "he", label: "עברית" },
    { value: "en", label: "English" },
    { value: "ar", label: "العربية" },
    { value: "ru", label: "Русский" },
];

export default function VideoClipsPage() {
    const [videoUrl, setVideoUrl] = useState("");
    const [videoType, setVideoType] = useState<1 | 2>(1); // 1=URL, 2=YouTube
    const [language, setLanguage] = useState("auto");
    const [preferLength, setPreferLength] = useState<number[]>([2, 3]);
    const [ratioOfClip, setRatioOfClip] = useState(1);
    const [maxClipNumber, setMaxClipNumber] = useState<number | undefined>(undefined);
    const [keywords, setKeywords] = useState("");
    const [projectName, setProjectName] = useState("");

    const [loading, setLoading] = useState(false);
    const [projectId, setProjectId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [clips, setClips] = useState<any[]>([]);

    // Detect if URL is YouTube
    const detectVideoType = (url: string) => {
        if (url.includes("youtube.com") || url.includes("youtu.be")) {
            setVideoType(2);
        } else {
            setVideoType(1);
        }
    };

    const handleSubmit = async () => {
        if (!videoUrl.trim()) {
            setError("נא להזין קישור לוידאו");
            return;
        }

        setLoading(true);
        setError(null);
        setProjectId(null);
        setStatus("יוצר פרויקט...");

        try {
            const res = await fetch("/api/vizard/slice", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    videoUrl: videoUrl.trim(),
                    videoType,
                    language,
                    preferLength,
                    ratioOfClip,
                    maxClipNumber: maxClipNumber || undefined,
                    keywords: keywords.trim() || undefined,
                    projectName: projectName.trim() || undefined,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "יצירת הפרויקט נכשלה");
            }

            setProjectId(data.projectId);
            setStatus("הפרויקט נוצר! בודק סטטוס...");

            // Start polling for status
            pollStatus(data.projectId);

        } catch (err: any) {
            setError(err.message);
            setStatus(null);
        } finally {
            setLoading(false);
        }
    };

    const pollStatus = async (pid: string) => {
        let attempts = 0;
        const maxAttempts = 60; // 10 minutes max

        const check = async () => {
            try {
                const res = await fetch(`/api/vizard/status?projectId=${pid}`);
                const data = await res.json();

                if (data.status === "completed" || data.status === "done") {
                    setStatus("הקליפים מוכנים!");
                    setClips(data.clips || []);
                    return;
                }

                if (data.status === "failed" || data.status === "error") {
                    setError(data.error || "העיבוד נכשל");
                    setStatus(null);
                    return;
                }

                attempts++;
                if (attempts < maxAttempts) {
                    setStatus(`מעבד... (${data.progress || 0}%)`);
                    setTimeout(check, 10000); // Check every 10 seconds
                } else {
                    setError("הזמן הקצוב עבר. נסה שוב מאוחר יותר.");
                    setStatus(null);
                }
            } catch (err) {
                attempts++;
                if (attempts < maxAttempts) {
                    setTimeout(check, 10000);
                }
            }
        };

        setTimeout(check, 5000); // First check after 5 seconds
    };

    const handleDownload = async (clipId: string) => {
        try {
            const res = await fetch(`/api/vizard/download?clipId=${clipId}`);
            const data = await res.json();

            if (data.downloadUrl) {
                window.open(data.downloadUrl, "_blank");
            }
        } catch (err) {
            console.error("Download error:", err);
        }
    };

    return (
        <div className="container mx-auto p-6 max-w-4xl" dir="rtl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">✂️ חיתוך וידאו לקליפים</h1>
                <p className="text-muted-foreground">
                    העלה סרטון ארוך וקבל קליפים קצרים מותאמים לרשתות חברתיות
                </p>
            </div>

            <div className="grid gap-6">
                {/* Video URL Input */}
                <Card className="p-6">
                    <Label className="text-lg font-semibold mb-3 block">
                        קישור לוידאו
                    </Label>
                    <div className="flex gap-2">
                        <Input
                            value={videoUrl}
                            onChange={(e) => {
                                setVideoUrl(e.target.value);
                                detectVideoType(e.target.value);
                            }}
                            placeholder="https://youtube.com/watch?v=... או קישור ישיר לקובץ"
                            className="flex-1"
                            dir="ltr"
                        />
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                        {videoType === 2 ? "🎬 זוהה כקישור YouTube" : "📁 קישור ישיר לקובץ"}
                    </p>
                </Card>

                {/* Settings */}
                <Card className="p-6">
                    <Tabs defaultValue="basic" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-4">
                            <TabsTrigger value="basic">הגדרות בסיסיות</TabsTrigger>
                            <TabsTrigger value="advanced">הגדרות מתקדמות</TabsTrigger>
                        </TabsList>

                        <TabsContent value="basic" className="space-y-6">
                            {/* Clip Length */}
                            <div>
                                <Label className="font-semibold mb-3 block">אורך קליפים</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    {CLIP_LENGTHS.map((opt) => (
                                        <button
                                            key={opt.label}
                                            onClick={() => setPreferLength(opt.value)}
                                            className={`p-3 rounded-lg border-2 text-right transition-all ${JSON.stringify(preferLength) === JSON.stringify(opt.value)
                                                    ? "border-primary bg-primary/5"
                                                    : "border-border hover:border-primary/50"
                                                }`}
                                        >
                                            <div className="font-medium">{opt.label}</div>
                                            <div className="text-xs text-muted-foreground">{opt.description}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Aspect Ratio */}
                            <div>
                                <Label className="font-semibold mb-3 block">יחס תצוגה</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    {ASPECT_RATIOS.map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setRatioOfClip(opt.value)}
                                            className={`p-3 rounded-lg border-2 text-right transition-all ${ratioOfClip === opt.value
                                                    ? "border-primary bg-primary/5"
                                                    : "border-border hover:border-primary/50"
                                                }`}
                                        >
                                            <div className="font-medium">
                                                {opt.icon} {opt.label}
                                            </div>
                                            <div className="text-xs text-muted-foreground">{opt.description}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Language */}
                            <div>
                                <Label className="font-semibold mb-3 block">שפת הוידאו</Label>
                                <div className="flex flex-wrap gap-2">
                                    {LANGUAGES.map((lang) => (
                                        <button
                                            key={lang.value}
                                            onClick={() => setLanguage(lang.value)}
                                            className={`px-4 py-2 rounded-full border transition-all ${language === lang.value
                                                    ? "border-primary bg-primary text-primary-foreground"
                                                    : "border-border hover:border-primary/50"
                                                }`}
                                        >
                                            {lang.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="advanced" className="space-y-6">
                            {/* Max Clips */}
                            <div>
                                <Label className="font-semibold mb-2 block">
                                    מספר קליפים מקסימלי
                                </Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={maxClipNumber || ""}
                                    onChange={(e) => setMaxClipNumber(e.target.value ? parseInt(e.target.value) : undefined)}
                                    placeholder="השאר ריק לכל הקליפים"
                                    className="max-w-[200px]"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    1-100, השאר ריק לקבלת כל הקליפים
                                </p>
                            </div>

                            {/* Keywords */}
                            <div>
                                <Label className="font-semibold mb-2 block">
                                    נושאים ספציפיים (אופציונלי)
                                </Label>
                                <Input
                                    value={keywords}
                                    onChange={(e) => setKeywords(e.target.value)}
                                    placeholder='למשל: "מצא את הרגע שבו מדברים על AI"'
                                    dir="rtl"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    AI ימצא רק קליפים שמתאימים לתיאור זה
                                </p>
                            </div>

                            {/* Project Name */}
                            <div>
                                <Label className="font-semibold mb-2 block">
                                    שם הפרויקט (אופציונלי)
                                </Label>
                                <Input
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                    placeholder="שם מותאם לפרויקט"
                                    dir="rtl"
                                />
                            </div>

                            {/* Features Info */}
                            <div className="bg-blue-50 dark:bg-blue-950/50 rounded-lg p-4">
                                <p className="font-semibold text-sm mb-2">✨ פיצ'רים שיופעלו אוטומטית:</p>
                                <ul className="text-sm text-muted-foreground space-y-1">
                                    <li>✅ הסרת שקטים ומילות מילוי</li>
                                    <li>✅ כתוביות אוטומטיות</li>
                                    <li>✅ הדגשת מילות מפתח</li>
                                    <li>✅ B-Roll אוטומטי</li>
                                    <li>✅ כותרת פתיחה (Hook)</li>
                                </ul>
                            </div>
                        </TabsContent>
                    </Tabs>
                </Card>

                {/* Submit */}
                <Button
                    onClick={handleSubmit}
                    disabled={loading || !videoUrl.trim()}
                    size="lg"
                    className="w-full text-lg py-6"
                >
                    {loading ? (
                        <span className="flex items-center gap-2">
                            <span className="animate-spin">⏳</span>
                            מעבד...
                        </span>
                    ) : (
                        "✂️ צור קליפים"
                    )}
                </Button>

                {/* Status */}
                {status && (
                    <Card className="p-4 bg-blue-50 dark:bg-blue-950/50">
                        <p className="text-center font-medium">{status}</p>
                        {projectId && (
                            <p className="text-center text-sm text-muted-foreground mt-1">
                                מזהה פרויקט: {projectId}
                            </p>
                        )}
                    </Card>
                )}

                {/* Error */}
                {error && (
                    <Card className="p-4 bg-destructive/10 text-destructive">
                        <p className="text-center font-medium">❌ {error}</p>
                    </Card>
                )}

                {/* Clips */}
                {clips.length > 0 && (
                    <Card className="p-6">
                        <h2 className="text-xl font-bold mb-4">🎬 הקליפים שלך ({clips.length})</h2>
                        <div className="grid gap-4">
                            {clips.map((clip, i) => (
                                <div
                                    key={clip.id || i}
                                    className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg"
                                >
                                    {clip.thumbnailUrl && (
                                        <img
                                            src={clip.thumbnailUrl}
                                            alt={`Clip ${i + 1}`}
                                            className="w-24 h-14 object-cover rounded"
                                        />
                                    )}
                                    <div className="flex-1">
                                        <p className="font-medium">
                                            קליפ {i + 1}
                                            {clip.duration && ` (${Math.round(clip.duration)}s)`}
                                        </p>
                                        {clip.title && (
                                            <p className="text-sm text-muted-foreground">{clip.title}</p>
                                        )}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDownload(clip.id)}
                                    >
                                        הורד
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
}