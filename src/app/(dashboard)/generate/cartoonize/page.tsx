"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Download, Upload, Palette } from "lucide-react";
import { toast } from "sonner";

export default function CartoonizePage() {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [resultUrl, setResultUrl] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

        try {
            const formData = new FormData();
            formData.append("image", selectedFile);

            const response = await fetch("/api/generate/cartoonize", {
                method: "POST",
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "שגיאה בהמרה");
            }

            setResultUrl(data.imageUrl);
            toast.success("הקריקטורה נוצרה בהצלחה!");
        } catch (err: any) {
            setError(err.message);
            toast.error(err.message);
        } finally {
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
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setSelectedFile(null);
        setPreviewUrl(null);
        setResultUrl(null);
        setError(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
        <div className="container mx-auto py-8 px-4" dir="rtl">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                        <Palette className="h-8 w-8 text-purple-500" />
                        המרה לקריקטורה
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
                                        <div className="w-full aspect-square max-h-80 bg-gray-100 rounded-lg flex items-center justify-center">
                                            <Loader2 className="h-12 w-12 animate-spin text-purple-500" />
                                        </div>
                                    ) : resultUrl ? (
                                        <img
                                            src={resultUrl}
                                            alt="קריקטורה"
                                            className="w-full rounded-lg border border-gray-200 object-contain max-h-80"
                                        />
                                    ) : (
                                        <div className="w-full aspect-square max-h-80 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 border border-dashed">
                                            התוצאה תופיע כאן
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
                                {error}
                            </div>
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
                                <Button
                                    variant="outline"
                                    size="lg"
                                    onClick={handleDownload}
                                >
                                    <Download className="h-5 w-5 ml-2" />
                                    הורד
                                </Button>
                            )}

                            {previewUrl && (
                                <Button
                                    variant="ghost"
                                    size="lg"
                                    onClick={handleReset}
                                >
                                    התחל מחדש
                                </Button>
                            )}
                        </div>
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
