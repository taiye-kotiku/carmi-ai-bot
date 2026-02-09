"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface Character {
    id: string;
    name: string;
    image_urls: string[];
    status: string;
}

export default function CharacterVideoPage() {
    // State
    const [characters, setCharacters] = useState<Character[]>([]);
    const [selectedCharId, setSelectedCharId] = useState<string>("");
    const [prompt, setPrompt] = useState("");

    // Status State
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<"idle" | "image" | "video_submit" | "video_processing" | "done">("idle");
    const [statusMsg, setStatusMsg] = useState("");
    const [error, setError] = useState<string | null>(null);

    // Result State
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);

    // 1. Load Characters
    useEffect(() => {
        async function loadChars() {
            try {
                const res = await fetch("/api/characters");
                const data = await res.json();
                const readyChars = (data.characters || []).filter((c: any) => c.status === "ready");
                setCharacters(readyChars);
                if (readyChars.length > 0) setSelectedCharId(readyChars[0].id);
            } catch (e) {
                console.error("Failed to load characters", e);
            }
        }
        loadChars();
    }, []);

    // 2. Main Process Flow
    const handleGenerate = async () => {
        if (!selectedCharId || !prompt.trim()) return;

        setLoading(true);
        setError(null);
        setGeneratedImage(null);
        setVideoUrl(null);

        try {
            // --- STEP 1: Generate Image ---
            setStep("image");
            setStatusMsg("🤖 שלב 1/2: מייצר תמונת בסיס עם הדמות שלך...");

            const imgRes = await fetch("/api/characters/generate-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    characterId: selectedCharId,
                    prompt: prompt, // Will be auto-translated by backend
                    aspectRatio: "16:9", // Best for video
                    loraScale: 1.0,
                }),
            });

            const imgData = await imgRes.json();

            if (!imgRes.ok) throw new Error(imgData.error || "Image generation failed");

            setGeneratedImage(imgData.imageUrl);

            // --- STEP 2: Submit to Video Generation ---
            setStep("video_submit");
            setStatusMsg("🎬 שלב 2/2: שולח להנפשה (Kling AI)...");

            const vidRes = await fetch("/api/characters/generate-video", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    imageUrl: imgData.imageUrl,
                    prompt: prompt, // Use same prompt for context
                    duration: "5",
                    aspectRatio: "16:9"
                }),
            });

            const vidData = await vidRes.json();

            if (!vidRes.ok) throw new Error(vidData.error || "Video submission failed");

            // --- STEP 3: Poll for Video Result ---
            setStep("video_processing");
            pollVideoStatus(vidData.generationId);

        } catch (err: any) {
            console.error(err);
            setError(err.message);
            setLoading(false);
            setStep("idle");
        }
    };

    // 3. Polling Logic
    const pollVideoStatus = (id: string) => {
        setStatusMsg("⏳ מעבד וידאו... (זה לוקח כ-3 דקות)");

        let attempts = 0;
        const maxAttempts = 60; // 5 minutes max

        const interval = setInterval(async () => {
            attempts++;
            try {
                const res = await fetch(`/api/generations/${id}/status`);
                const data = await res.json();

                if (data.status === "completed") {
                    clearInterval(interval);
                    setVideoUrl(data.url);
                    setStep("done");
                    setStatusMsg("✨ הווידאו מוכן!");
                    setLoading(false);
                } else if (data.status === "failed") {
                    clearInterval(interval);
                    setError("יצירת הוידאו נכשלה בצד השרת");
                    setLoading(false);
                    setStep("idle");
                } else if (attempts >= maxAttempts) {
                    clearInterval(interval);
                    setError("הזמן הקצוב עבר. אנא בדוק בגלריה מאוחר יותר.");
                    setLoading(false);
                    setStep("idle");
                }
            } catch (e) {
                console.error("Polling error", e);
            }
        }, 5000); // Check every 5 seconds
    };

    const selectedChar = characters.find(c => c.id === selectedCharId);

    return (
        <div className="container mx-auto p-6 max-w-6xl" dir="rtl">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold mb-2">🎬 יצירת וידאו דמות (Full Flow)</h1>
                    <p className="text-muted-foreground">
                        תהליך אוטומטי: יצירת תמונה מהדמות שלך ⬅️ הנפשה לוידאו
                    </p>
                </div>
                <Badge variant="secondary" className="text-base px-4 py-1">
                    עלות: 11 קרדיטים
                </Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* --- Left Column: Controls --- */}
                <div className="lg:col-span-4 space-y-6">
                    {/* 1. Select Character */}
                    <Card className="p-5">
                        <Label className="text-lg font-semibold mb-4 block">1. בחר דמות</Label>
                        {characters.length === 0 ? (
                            <div className="text-center p-4 bg-muted/50 rounded-lg">
                                <p className="text-sm">אין דמויות מוכנות.</p>
                                <Button asChild variant="link" className="mt-2">
                                    <a href="/characters">צור דמות חדשה &rarr;</a>
                                </Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-2">
                                {characters.map((char) => (
                                    <button
                                        key={char.id}
                                        onClick={() => setSelectedCharId(char.id)}
                                        className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${selectedCharId === char.id
                                                ? "border-primary ring-2 ring-primary/20"
                                                : "border-transparent hover:border-muted"
                                            }`}
                                    >
                                        <img
                                            src={char.image_urls?.[0]}
                                            alt={char.name}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] p-1 text-center truncate">
                                            {char.name}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </Card>

                    {/* 2. Prompt */}
                    <Card className="p-5">
                        <Label className="text-lg font-semibold mb-2 block">2. תאר את הוידאו</Label>
                        <Textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="לדוגמה: יושב בבית קפה, מחייך למצלמה, תאורה קולנועית, תנועה איטית..."
                            className="h-32 mb-2"
                        />
                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                            <span>🌐</span>
                            <span>תרגום לאנגלית ושיפור פרומפט מבוצעים אוטומטית</span>
                        </div>
                    </Card>

                    {error && (
                        <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-sm font-medium">
                            ⚠️ {error}
                        </div>
                    )}

                    <Button
                        onClick={handleGenerate}
                        disabled={loading || !selectedCharId || !prompt.trim()}
                        size="lg"
                        className="w-full text-lg py-8 shadow-lg shadow-primary/20"
                    >
                        {loading ? (
                            <span className="flex items-center gap-2">
                                <span className="animate-spin">⏳</span>
                                מעבד...
                            </span>
                        ) : (
                            "✨ צור וידאו מלא"
                        )}
                    </Button>
                </div>

                {/* --- Right Column: Preview & Result --- */}
                <div className="lg:col-span-8 space-y-6">
                    <Card className="aspect-video bg-black/5 dark:bg-black/40 flex flex-col items-center justify-center relative overflow-hidden border-2 border-dashed border-muted">

                        {/* Status Overlay */}
                        {loading && (
                            <div className="absolute inset-0 z-20 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6"></div>
                                <h3 className="text-xl font-bold mb-2 animate-pulse">{statusMsg}</h3>

                                {/* Progress Steps */}
                                <div className="w-full max-w-md space-y-4 mt-8">
                                    <div className={`flex items-center gap-3 ${step === 'image' ? 'text-primary' : 'text-muted-foreground'}`}>
                                        <div className={`w-3 h-3 rounded-full ${step === 'image' ? 'bg-primary animate-ping' : 'bg-muted'}`} />
                                        <span>1. יצירת תמונה (Modal FLUX LoRA)</span>
                                    </div>
                                    <div className={`flex items-center gap-3 ${step === 'video_submit' ? 'text-primary' : 'text-muted-foreground'}`}>
                                        <div className={`w-3 h-3 rounded-full ${step === 'video_submit' ? 'bg-primary animate-ping' : 'bg-muted'}`} />
                                        <span>2. שליחה להנפשה</span>
                                    </div>
                                    <div className={`flex items-center gap-3 ${step === 'video_processing' ? 'text-primary' : 'text-muted-foreground'}`}>
                                        <div className={`w-3 h-3 rounded-full ${step === 'video_processing' ? 'bg-primary animate-ping' : 'bg-muted'}`} />
                                        <span>3. עיבוד וידאו (Kling AI)</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Final Video */}
                        {videoUrl ? (
                            <video
                                src={videoUrl}
                                controls
                                autoPlay
                                loop
                                className="w-full h-full object-contain bg-black"
                            />
                        ) : generatedImage ? (
                            // Intermediate Image
                            <div className="relative w-full h-full">
                                <img
                                    src={generatedImage}
                                    className="w-full h-full object-contain"
                                    alt="Generated Base"
                                />
                                <div className="absolute bottom-4 right-4 bg-black/60 text-white px-3 py-1 rounded text-sm">
                                    תמונת בסיס
                                </div>
                            </div>
                        ) : (
                            // Placeholder
                            <div className="text-center text-muted-foreground">
                                <div className="text-6xl mb-4 opacity-20">🎬</div>
                                <p className="text-lg">הוידאו המוכן יופיע כאן</p>
                            </div>
                        )}
                    </Card>

                    {/* Action Buttons */}
                    {videoUrl && (
                        <div className="flex gap-4">
                            <Button
                                className="flex-1"
                                variant="outline"
                                onClick={() => window.open(videoUrl, "_blank")}
                            >
                                ⬇️ הורד וידאו
                            </Button>
                            <Button
                                className="flex-1"
                                variant="outline"
                                onClick={() => {
                                    if (generatedImage) window.open(generatedImage, "_blank");
                                }}
                            >
                                🖼️ הורד תמונת מקור
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}