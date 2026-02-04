"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import {
    Loader2, Download, Sparkles, User, Image as ImageIcon,
    Video, ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface Character {
    id: string;
    name: string;
    thumbnail_url: string;
    trigger_word: string;
    model_status: string;
    lora_url: string | null;
}

const IMAGE_ASPECTS = [
    { value: "1:1", label: "1:1" },
    { value: "4:3", label: "4:3" },
    { value: "3:4", label: "3:4" },
    { value: "16:9", label: "16:9" },
    { value: "9:16", label: "9:16" },
];

const VIDEO_ASPECTS = [
    { value: "16:9", label: "16:9 (רוחבי)" },
    { value: "9:16", label: "9:16 (סטורי)" },
];

const VIDEO_RESOLUTIONS = [
    { value: "480p", label: "480p (מהיר)" },
    { value: "580p", label: "580p" },
    { value: "720p", label: "720p (איכותי)" },
];

export default function CharacterGeneratePage() {
    const searchParams = useSearchParams();
    const characterId = searchParams.get("id");

    const [character, setCharacter] = useState<Character | null>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState("image");

    // Image settings
    const [imagePrompt, setImagePrompt] = useState("");
    const [imageAspect, setImageAspect] = useState("1:1");
    const [numImages, setNumImages] = useState(1);
    const [generatingImage, setGeneratingImage] = useState(false);
    const [imageResults, setImageResults] = useState<string[]>([]);

    // Video settings
    const [videoPrompt, setVideoPrompt] = useState("");
    const [videoAspect, setVideoAspect] = useState("16:9");
    const [videoResolution, setVideoResolution] = useState("720p");
    const [proMode, setProMode] = useState(false);
    const [generatingVideo, setGeneratingVideo] = useState(false);
    const [videoResult, setVideoResult] = useState<string | null>(null);

    useEffect(() => {
        if (characterId) {
            fetchCharacter();
        } else {
            setLoading(false);
        }
    }, [characterId]);

    async function fetchCharacter() {
        try {
            const res = await fetch(`/api/characters/${characterId}`);
            if (res.ok) {
                const data = await res.json();
                setCharacter(data);
            }
        } catch (err) {
            toast.error("שגיאה בטעינת הדמות");
        } finally {
            setLoading(false);
        }
    }

    async function generateImage() {
        if (!imagePrompt.trim() || !character) return;

        setGeneratingImage(true);
        setImageResults([]);

        try {
            // Step 1: Submit the job
            const res = await fetch(`/api/characters/${character.id}/image`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: imagePrompt,
                    aspectRatio: imageAspect,
                    numImages,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to submit");
            }

            const generationId = data.generationId;
            toast.info("התמונה נשלחה לעיבוד...");

            // Step 2: Poll for results
            let attempts = 0;
            const maxAttempts = 60; // 2 minutes max

            while (attempts < maxAttempts) {
                await new Promise(r => setTimeout(r, 2000)); // Wait 2 seconds

                const statusRes = await fetch(`/api/generations/${generationId}/status`);
                const status = await statusRes.json();

                console.log(`Poll ${attempts + 1}:`, status.status);

                if (status.status === "completed" && status.images?.length > 0) {
                    setImageResults(status.images);
                    toast.success("התמונות נוצרו בהצלחה!");
                    return;
                }

                if (status.status === "failed") {
                    throw new Error(status.error || "Generation failed");
                }

                attempts++;
            }

            throw new Error("Timeout - נסה שוב");

        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setGeneratingImage(false);
        }
    }

    async function generateVideo() {
        if (!videoPrompt.trim() || !character) return;

        setGeneratingVideo(true);
        setVideoResult(null);

        try {
            const res = await fetch(`/api/characters/${character.id}/video`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: videoPrompt,
                    aspectRatio: videoAspect,
                    resolution: videoResolution,
                    proMode,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Video generation failed");
            }

            setVideoResult(data.videoUrl);
            toast.success("הסרטון נוצר בהצלחה!");
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setGeneratingVideo(false);
        }
    }

    async function handleDownload(url: string, type: "image" | "video", index = 0) {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = `${character?.name}-${type}-${Date.now()}-${index + 1}.${type === "video" ? "mp4" : "jpg"}`;
            a.click();
            URL.revokeObjectURL(downloadUrl);
        } catch {
            window.open(url, "_blank");
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
        );
    }

    if (!characterId || !character) {
        return (
            <div className="max-w-2xl mx-auto text-center py-12">
                <User className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                <h2 className="text-xl font-semibold mb-2">לא נבחרה דמות</h2>
                <p className="text-gray-500 mb-6">בחר דמות מהרשימה כדי להתחיל ליצור</p>
                <Link href="/characters">
                    <Button>
                        <ArrowRight className="h-4 w-4 ml-2" />
                        לדף הדמויות
                    </Button>
                </Link>
            </div>
        );
    }

    if (character.model_status !== "ready") {
        return (
            <div className="max-w-2xl mx-auto text-center py-12">
                <Loader2 className="h-16 w-16 mx-auto text-blue-500 animate-spin mb-4" />
                <h2 className="text-xl font-semibold mb-2">הדמות עדיין באימון</h2>
                <p className="text-gray-500 mb-6">נא להמתין עד שהאימון יסתיים (~15 דקות)</p>
                <Link href="/characters">
                    <Button variant="outline">
                        חזרה לדמויות
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto" dir="rtl">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <img
                    src={character.thumbnail_url}
                    alt={character.name}
                    className="h-16 w-16 rounded-xl object-cover"
                />
                <div>
                    <h1 className="text-2xl font-bold">{character.name}</h1>
                    <p className="text-gray-500">צור תמונות וסרטונים עם הדמות</p>
                </div>
            </div>

            <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="mb-6">
                    <TabsTrigger value="image" className="flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        תמונות
                    </TabsTrigger>
                    <TabsTrigger value="video" className="flex items-center gap-2">
                        <Video className="h-4 w-4" />
                        סרטונים
                    </TabsTrigger>
                </TabsList>

                {/* Image Generation */}
                <TabsContent value="image">
                    <div className="grid md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>הגדרות תמונה</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">תיאור הסצנה</label>
                                    <Textarea
                                        placeholder="תאר את הסצנה... לדוגמה: יושב בבית קפה פריזאי, אור רך"
                                        value={imagePrompt}
                                        onChange={(e) => setImagePrompt(e.target.value)}
                                        rows={3}
                                        disabled={generatingImage}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">יחס תצוגה</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {IMAGE_ASPECTS.map((a) => (
                                            <button
                                                key={a.value}
                                                onClick={() => setImageAspect(a.value)}
                                                disabled={generatingImage}
                                                className={`px-3 py-2 rounded-lg border text-sm ${imageAspect === a.value
                                                    ? "bg-purple-500 border-purple-500 text-white"
                                                    : "hover:border-purple-300"
                                                    }`}
                                            >
                                                {a.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        מספר תמונות: {numImages}
                                    </label>
                                    <Slider
                                        value={[numImages]}
                                        onValueChange={([v]) => setNumImages(v)}
                                        min={1}
                                        max={4}
                                        disabled={generatingImage}
                                    />
                                </div>

                                <Button
                                    onClick={generateImage}
                                    disabled={!imagePrompt.trim() || generatingImage}
                                    className="w-full"
                                    size="lg"
                                >
                                    {generatingImage ? (
                                        <>
                                            <Loader2 className="h-5 w-5 ml-2 animate-spin" />
                                            יוצר תמונות...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="h-5 w-5 ml-2" />
                                            צור {numImages} תמונות
                                        </>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>תוצאות</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {imageResults.length === 0 ? (
                                    <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                                        התמונות יופיעו כאן
                                    </div>
                                ) : (
                                    <div className={`grid gap-2 ${imageResults.length > 1 ? "grid-cols-2" : ""}`}>
                                        {imageResults.map((url, i) => (
                                            <div key={i} className="relative group">
                                                <img src={url} alt="" className="w-full rounded-lg" />
                                                <Button
                                                    size="icon"
                                                    variant="secondary"
                                                    className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => handleDownload(url, "image", i)}
                                                >
                                                    <Download className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Video Generation */}
                <TabsContent value="video">
                    <div className="grid md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>הגדרות סרטון</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">תיאור הסרטון</label>
                                    <Textarea
                                        placeholder="תאר את הפעולה... לדוגמה: הולך ברחוב טוקיו בלילה, שלטי ניאון"
                                        value={videoPrompt}
                                        onChange={(e) => setVideoPrompt(e.target.value)}
                                        rows={3}
                                        disabled={generatingVideo}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">יחס תצוגה</label>
                                    <div className="flex gap-2">
                                        {VIDEO_ASPECTS.map((a) => (
                                            <button
                                                key={a.value}
                                                onClick={() => setVideoAspect(a.value)}
                                                disabled={generatingVideo}
                                                className={`flex-1 px-3 py-2 rounded-lg border text-sm ${videoAspect === a.value
                                                    ? "bg-purple-500 border-purple-500 text-white"
                                                    : "hover:border-purple-300"
                                                    }`}
                                            >
                                                {a.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">רזולוציה</label>
                                    <div className="flex gap-2">
                                        {VIDEO_RESOLUTIONS.map((r) => (
                                            <button
                                                key={r.value}
                                                onClick={() => setVideoResolution(r.value)}
                                                disabled={generatingVideo}
                                                className={`flex-1 px-3 py-2 rounded-lg border text-sm ${videoResolution === r.value
                                                    ? "bg-purple-500 border-purple-500 text-white"
                                                    : "hover:border-purple-300"
                                                    }`}
                                            >
                                                {r.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg">
                                    <input
                                        type="checkbox"
                                        id="proMode"
                                        checked={proMode}
                                        onChange={(e) => setProMode(e.target.checked)}
                                        disabled={generatingVideo}
                                        className="h-4 w-4"
                                    />
                                    <label htmlFor="proMode" className="text-sm">
                                        <span className="font-medium">מצב Pro</span>
                                        <span className="text-gray-500"> - איכות גבוהה יותר (x2 קרדיטים)</span>
                                    </label>
                                </div>

                                <Button
                                    onClick={generateVideo}
                                    disabled={!videoPrompt.trim() || generatingVideo}
                                    className="w-full"
                                    size="lg"
                                >
                                    {generatingVideo ? (
                                        <>
                                            <Loader2 className="h-5 w-5 ml-2 animate-spin" />
                                            יוצר סרטון (2-5 דקות)...
                                        </>
                                    ) : (
                                        <>
                                            <Video className="h-5 w-5 ml-2" />
                                            צור סרטון {proMode ? "(Pro)" : ""}
                                        </>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>תוצאה</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {!videoResult ? (
                                    <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                                        הסרטון יופיע כאן
                                    </div>
                                ) : (
                                    <div className="relative group">
                                        <video
                                            src={videoResult}
                                            controls
                                            autoPlay
                                            loop
                                            className="w-full rounded-lg"
                                        />
                                        <Button
                                            size="icon"
                                            variant="secondary"
                                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => handleDownload(videoResult, "video")}
                                        >
                                            <Download className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}