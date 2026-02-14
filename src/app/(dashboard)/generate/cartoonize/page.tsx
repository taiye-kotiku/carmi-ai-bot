"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Loader2, Download, Upload, Palette } from "lucide-react";
import { toast } from "sonner";
import { useNotifications } from "@/lib/notifications/notification-context";
import { ExportFormats } from "@/components/export-formats";
import { CREDIT_COSTS } from "@/lib/config/credits";

export default function CartoonizePage() {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [resultUrl, setResultUrl] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [subjectDescription, setSubjectDescription] = useState("");
    const [settingEnvironment, setSettingEnvironment] = useState("");
    const [hobbyProfession, setHobbyProfession] = useState("");

    const fileInputRef = useRef<HTMLInputElement>(null);
    const pollRef = useRef<NodeJS.Timeout | null>(null);
    const isCompletedRef = useRef(false);

    const { addGenerationNotification } = useNotifications();

    const stopPolling = useCallback(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }, []);

    const pollJob = useCallback(
        (jobId: string) => {
            // Safety clear
            if (pollRef.current) clearInterval(pollRef.current);

            pollRef.current = setInterval(async () => {
                try {
                    const res = await fetch(`/api/jobs/${jobId}`);
                    const data = await res.json();

                    if (data.progress) {
                        setProgress(data.progress);
                    }

                    if (data.status === "completed") {
                        // Prevent duplicate handling
                        if (isCompletedRef.current) return;
                        isCompletedRef.current = true;

                        stopPolling();

                        const imageUrl = data.result?.imageUrl || data.result?.url;
                        if (imageUrl) {
                            setResultUrl(imageUrl);
                            setProgress(100);
                            setStatusText("הקריקטורה מוכנה!");
                            toast.success("הקריקטורה נוצרה בהצלחה!");
                            addGenerationNotification("caricature");
                        } else {
                            setError("לא התקבלה תמונה");
                        }
                        setIsGenerating(false);
                    } else if (data.status === "failed") {
                        if (isCompletedRef.current) return;
                        isCompletedRef.current = true;

                        stopPolling();
                        setError(data.error || "יצירת הקריקטורה נכשלה");
                        toast.error(data.error || "יצירת הקריקטורה נכשלה");
                        setIsGenerating(false);
                        setProgress(0);
                    } else {
                        // Processing state
                        if (data.progress < 20) {
                            setStatusText("מנתח את התמונה...");
                        } else if (data.progress < 50) {
                            setStatusText("מזהה תווי פנים...");
                        } else if (data.progress < 80) {
                            setStatusText("יוצר קריקטורה...");
                        } else {
                            setStatusText("מעבד ושומר...");
                        }
                    }
                } catch (err) {
                    console.error("Poll error:", err);
                }
            }, 3000);
        },
        [stopPolling, addGenerationNotification]
    );

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            toast.error("נא לבחור קובץ תמונה (PNG, JPG, WebP)");
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            toast.error("גודל הקובץ מקסימלי 10MB");
            return;
        }
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        setResultUrl(null);
        setError(null);
    };

    const handleGenerate = async () => {
        if (!selectedFile) return;

        setIsGenerating(true);
        setError(null);
        setResultUrl(null);
        setProgress(5);
        setStatusText("מעלה תמונה...");
        isCompletedRef.current = false; // Reset completion flag

        try {
            const formData = new FormData();
            formData.append("image", selectedFile);
            if (subjectDescription.trim()) formData.append("subject_description", subjectDescription.trim());
            if (settingEnvironment.trim()) formData.append("setting_environment", settingEnvironment.trim());
            if (hobbyProfession.trim()) formData.append("hobby_profession", hobbyProfession.trim());

            const response = await fetch("/api/generate/cartoonize", {
                method: "POST",
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "שגיאה בהמרה");
            }

            if (data.jobId) {
                setProgress(10);
                setStatusText("מנתח את התמונה...");
                pollJob(data.jobId);
            } else {
                throw new Error("לא התקבל מזהה עבודה");
            }
        } catch (err: any) {
            setError(err.message);
            toast.error(err.message);
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!resultUrl) return;
        const a = document.createElement("a");
        a.href = resultUrl;
        a.download = `cartoon-${selectedFile?.name || "image"}.png`;
        a.click();
    };

    const handleReset = () => {
        stopPolling();
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setSelectedFile(null);
        setPreviewUrl(null);
        setResultUrl(null);
        setError(null);
        setProgress(0);
        setStatusText("");
        setSubjectDescription("");
        setSettingEnvironment("");
        setHobbyProfession("");
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
        <div className="container mx-auto py-8 px-4" dir="rtl">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                        <Palette className="h-8 w-8 text-purple-500" />
                        יצירת קריקטורה
                    </h1>
                    <p className="text-gray-600">
                        העלה תמונה ודמותך תהפוך לקריקטורה בסגנון איור דיגיטלי
                    </p>
                </div>

                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>בחר תמונה להמרה</CardTitle>
                        <p className="text-sm text-gray-500 mt-1">
                            PNG, JPG או WebP עד 10MB. מומלץ תמונה עם פנים ברורים.
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                            onChange={handleFileChange}
                            className="hidden"
                        />

                        {!previewUrl ? (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50/50 transition-colors"
                            >
                                <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                                <p className="text-gray-600 font-medium">לחץ להעלאת תמונה</p>
                                <p className="text-sm text-gray-400 mt-1">או גרור קובץ לכאן</p>
                            </div>
                        ) : (
                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <p className="text-sm font-medium text-gray-600 mb-2">מקור</p>
                                    <img
                                        src={previewUrl}
                                        alt="מקור"
                                        className="w-full rounded-lg border border-gray-200 object-contain max-h-80"
                                    />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-600 mb-2">קריקטורה</p>
                                    {isGenerating ? (
                                        <div className="w-full aspect-square max-h-80 bg-gray-100 rounded-lg flex flex-col items-center justify-center gap-3">
                                            <Loader2 className="h-12 w-12 animate-spin text-purple-500" />
                                            <p className="text-sm text-gray-500">{statusText}</p>
                                        </div>
                                    ) : resultUrl ? (
                                        <div className="space-y-3">
                                            <img
                                                src={resultUrl}
                                                alt="קריקטורה"
                                                className="w-full rounded-lg border border-gray-200 object-contain max-h-80"
                                            />
                                            <ExportFormats
                                                imageUrl={resultUrl}
                                                baseFilename={`caricature-${selectedFile?.name?.replace(/\.[^/.]+$/, "") || "image"}`}
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-full aspect-square max-h-80 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 border border-dashed">
                                            התוצאה תופיע כאן
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {previewUrl && (
                            <div className="space-y-4 pt-4 border-t">
                                <div>
                                    <Label htmlFor="subject_description" className="text-sm font-medium">
                                        תיאור הדמות (אופציונלי)
                                    </Label>
                                    <Input
                                        id="subject_description"
                                        type="text"
                                        placeholder="לדוגמה: גבר צעיר עם שיער שחור, חולצה כחולה"
                                        value={subjectDescription}
                                        onChange={(e) => setSubjectDescription(e.target.value)}
                                        className="mt-1"
                                        disabled={isGenerating}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        תאר את הדמות בתמונה. אם לא תזין, המערכת תזהה אוטומטית.
                                    </p>
                                </div>
                                <div>
                                    <Label htmlFor="setting_environment" className="text-sm font-medium">
                                        סביבה/רקע (אופציונלי)
                                    </Label>
                                    <Input
                                        id="setting_environment"
                                        type="text"
                                        placeholder="לדוגמה: משרד מודרני, חוף ים, פארק ירוק"
                                        value={settingEnvironment}
                                        onChange={(e) => setSettingEnvironment(e.target.value)}
                                        className="mt-1"
                                        disabled={isGenerating}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        תאר את הסביבה או הרקע הרצוי לקריקטורה.
                                    </p>
                                </div>
                                <div>
                                    <Label htmlFor="hobby_profession" className="text-sm font-medium">
                                        תחביב/מקצוע (אופציונלי)
                                    </Label>
                                    <Input
                                        id="hobby_profession"
                                        type="text"
                                        placeholder="לדוגמה: תכנות, צילום, מוזיקה, בישול"
                                        value={hobbyProfession}
                                        onChange={(e) => setHobbyProfession(e.target.value)}
                                        className="mt-1"
                                        disabled={isGenerating}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        ציין תחביב או מקצוע שיוצג בקריקטורה.
                                    </p>
                                </div>
                            </div>
                        )}

                        {isGenerating && (
                            <div className="space-y-2">
                                <Progress value={progress} />
                                <p className="text-sm text-center text-gray-500">
                                    {progress}% הושלם - {statusText}
                                </p>
                            </div>
                        )}

                        {error && (
                            <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
                        )}

                        <div className="flex gap-3">
                            <Button
                                onClick={handleGenerate}
                                disabled={!selectedFile || isGenerating}
                                size="lg"
                                className="flex-1"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="h-5 w-5 ml-2 animate-spin" />
                                        יוצר קריקטורה...
                                    </>
                                ) : (
                                    <>
                                        <Palette className="h-5 w-5 ml-2" />
                                        המר לקריקטורה
                                    </>
                                )}
                            </Button>
                            {resultUrl && (
                                <Button variant="outline" size="lg" onClick={handleDownload}>
                                    <Download className="h-5 w-5 ml-2" />
                                    הורד
                                </Button>
                            )}
                            {previewUrl && (
                                <Button variant="ghost" size="lg" onClick={handleReset}>
                                    התחל מחדש
                                </Button>
                            )}
                        </div>

                        <p className="text-sm text-pink-600 text-center mt-3">
                            עלות: {CREDIT_COSTS.caricature_generation} קרדיטים
                        </p>
                    </CardContent>
                </Card>

                <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                    <p className="text-sm text-purple-800">
                        <strong>טיפ:</strong> תמונות עם פנים ברורים, תאורה טובה ונגישות מלאה לפנים מניבות תוצאות טובות יותר.
                    </p>
                </div>
            </div>
        </div>
    );
}