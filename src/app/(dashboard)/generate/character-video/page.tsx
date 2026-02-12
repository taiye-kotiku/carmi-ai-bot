"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
<<<<<<< HEAD
import { useNotifications } from "@/lib/notifications/notification-context";
=======
import { CREDIT_COSTS } from "@/lib/config/credits";
>>>>>>> 3e18db9e5aa5377a6d446065cd8eae94ee5a59c0

interface Character {
    id: string;
    name: string;
    image_urls: string[];
    status: string;
}

type Step = "idle" | "scenes" | "images" | "video" | "done";

export default function CharacterVideoPage() {
    const [characters, setCharacters] = useState<Character[]>([]);
    const [selectedCharId, setSelectedCharId] = useState<string>("");
    const [prompt, setPrompt] = useState("");
    const sceneCount = 1; // Always 1 scene

    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<Step>("idle");
    const [statusMsg, setStatusMsg] = useState("");
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const [generatedImages, setGeneratedImages] = useState<string[]>([]);
    const [sceneVideoUrls, setSceneVideoUrls] = useState<string[]>([]);
    const [mainVideoUrl, setMainVideoUrl] = useState<string | null>(null);

    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    const { addGenerationNotification } = useNotifications();

    useEffect(() => {
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, []);

    useEffect(() => {
        async function loadChars() {
            try {
                const res = await fetch("/api/characters");
                const data = await res.json();
                const readyChars = (data.characters || []).filter(
                    (c: any) => c.status === "ready"
                );
                setCharacters(readyChars);
                if (readyChars.length > 0) setSelectedCharId(readyChars[0].id);
            } catch (e) {
                console.error("Failed to load characters", e);
            }
        }
        loadChars();
    }, []);

<<<<<<< HEAD
    const imageCost = sceneCount * 1;
    const videoCost = sceneCount * 3;
    const totalCost = imageCost + videoCost;
=======
    // Credit cost calculation - fixed cost for video generation
    const totalCost = CREDIT_COSTS.video_generation;
>>>>>>> 3e18db9e5aa5377a6d446065cd8eae94ee5a59c0

    const handleGenerate = async () => {
        if (!selectedCharId || !prompt.trim()) return;

        setLoading(true);
        setError(null);
        setGeneratedImages([]);
        setSceneVideoUrls([]);
        setMainVideoUrl(null);
        setProgress(0);
        setStep("scenes");
        setStatusMsg("📝 מייצר תסריט סצנות...");

        try {
            const res = await fetch("/api/generate/character-video", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    character_id: selectedCharId,
                    topic: prompt,
                    scene_count: sceneCount,
                    aspect_ratio: "16:9",
                    scene_duration: 5,
                    style: "storytelling",
                }),
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "שגיאה ביצירת הבקשה");

            pollJob(data.jobId);
        } catch (err: any) {
            console.error(err);
            setError(err.message);
            setLoading(false);
            setStep("idle");
        }
    };

    const pollJob = (jobId: string) => {
        let attempts = 0;
        const maxAttempts = 120;

        pollingRef.current = setInterval(async () => {
            attempts++;
            try {
                const res = await fetch(`/api/jobs/${jobId}`);
                const data = await res.json();

                const jobProgress = data.progress || 0;
                setProgress(jobProgress);

                if (jobProgress < 15) {
                    setStep("scenes");
                    setStatusMsg("📝 מייצר תסריט סצנות...");
                } else if (jobProgress < 45) {
                    setStep("images");
                    setStatusMsg("🎨 מייצר תמונות דמות...");
                } else if (jobProgress < 95) {
                    setStep("video");
                    setStatusMsg("🎬 מייצר וידאו (Veo 3)...");
                }

                if (data.status === "completed") {
                    if (pollingRef.current) clearInterval(pollingRef.current);

                    const result = data.result || {};
                    setMainVideoUrl(result.videoUrl || null);
                    setGeneratedImages(result.imageUrls || []);
                    setSceneVideoUrls(result.sceneVideoUrls || []);
                    setStep("done");
                    setStatusMsg("✨ הוידאו מוכן!");
                    setProgress(100);
                    setLoading(false);
                    addGenerationNotification("video");
                } else if (data.status === "failed") {
                    if (pollingRef.current) clearInterval(pollingRef.current);
                    setError(data.error || "יצירת הוידאו נכשלה");
                    setLoading(false);
                    setStep("idle");
                } else if (attempts >= maxAttempts) {
                    if (pollingRef.current) clearInterval(pollingRef.current);
                    setError("הזמן הקצוב עבר. אנא בדוק בגלריה מאוחר יותר.");
                    setLoading(false);
                    setStep("idle");
                }
            } catch (e) {
                console.error("Polling error", e);
            }
        }, 5000);
    };

    const selectedChar = characters.find((c) => c.id === selectedCharId);

    const steps: { key: Step; label: string; detail: string }[] = [
        { key: "scenes", label: "תסריט", detail: "יצירת סצנות עם AI" },
        { key: "images", label: "תמונות", detail: "Modal FLUX LoRA" },
        { key: "video", label: "וידאו", detail: "Veo 3 Image-to-Video" },
    ];

    const stepOrder: Step[] = ["scenes", "images", "video", "done"];

    const getStepStatus = (s: Step) => {
        const currentIdx = stepOrder.indexOf(step);
        const thisIdx = stepOrder.indexOf(s);
        if (thisIdx < currentIdx) return "completed";
        if (thisIdx === currentIdx && loading) return "active";
        return "pending";
    };

    return (
        <div className="container mx-auto p-6 max-w-6xl" dir="rtl">
            <div className="flex items-center justify-between mb-8">
                <div>
<<<<<<< HEAD
                    <h1 className="text-3xl font-bold mb-2">🎬 יצירת וידאו דמות</h1>
                    <p className="text-muted-foreground">תהליך אוטומטי: תסריט ⬅️ תמונות דמות (Modal) ⬅️ הנפשה (Veo 3)</p>
                </div>
                <Badge variant="secondary" className="text-base px-4 py-1">עלות: {totalCost} קרדיטים ({imageCost} תמונה + {videoCost} וידאו)</Badge>
=======
                    <h1 className="text-3xl font-bold mb-2">
                        🎬 יצירת וידאו דמות
                    </h1>
                    <p className="text-muted-foreground">
                        תהליך אוטומטי: תסריט ⬅️ תמונות דמות ⬅️ הנפשה
                
                    </p>
                </div>
                <Badge
                    variant="secondary"
                    className="text-base px-4 py-1"
                >
                    עלות: {totalCost} קרדיטים
                </Badge>
>>>>>>> 3e18db9e5aa5377a6d446065cd8eae94ee5a59c0
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4 space-y-6">
                    <Card className="p-5">
                        <Label className="text-lg font-semibold mb-4 block">1. בחר דמות</Label>
                        {characters.length === 0 ? (
                            <div className="text-center p-4 bg-muted/50 rounded-lg">
                                <p className="text-sm">אין דמויות מוכנות.</p>
                                <Button asChild variant="link" className="mt-2"><a href="/characters">צור דמות חדשה &rarr;</a></Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-2">
                                {characters.map((char) => (
                                    <button key={char.id} onClick={() => setSelectedCharId(char.id)} className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${selectedCharId === char.id ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-muted"}`}>
                                        <img src={char.image_urls?.[0]} alt={char.name} className="w-full h-full object-cover" />
                                        <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] p-1 text-center truncate">{char.name}</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </Card>

                    <Card className="p-5">
                        <Label className="text-lg font-semibold mb-2 block">2. תאר את הנושא</Label>
                        <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="לדוגמה: יושב בבית קפה, מחייך למצלמה, תאורה קולנועית..." className="h-28 mb-3" disabled={loading} />
                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                            <span>🌐</span><span>תרגום ושיפור פרומפט אוטומטי</span>
                        </div>
                    </Card>

<<<<<<< HEAD
                    <Card className="p-5">
                        <Label className="text-lg font-semibold mb-3 block">3. מספר סצנות</Label>
                        <div className="flex gap-2">
                            {[1, 2, 3, 5].map((n) => (
                                <button key={n} onClick={() => setSceneCount(n)} disabled={loading} className={`flex-1 py-3 rounded-lg border-2 text-center font-bold transition-all ${sceneCount === n ? "border-primary bg-primary/10 text-primary" : "border-muted hover:border-muted-foreground/30"}`}>{n}</button>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">כל סצנה = תמונה (1 קרדיט) + וידאו 5 שניות (3 קרדיטים)</p>
                    </Card>
=======
                    {/* Scene Count */}
>>>>>>> 3e18db9e5aa5377a6d446065cd8eae94ee5a59c0

                    {error && (<div className="bg-destructive/10 text-destructive p-4 rounded-lg text-sm font-medium">⚠️ {error}</div>)}

                    <Button onClick={handleGenerate} disabled={loading || !selectedCharId || !prompt.trim()} size="lg" className="w-full text-lg py-8 shadow-lg shadow-primary/20">
                        {loading ? (<span className="flex items-center gap-2"><span className="animate-spin">⏳</span>מעבד...</span>) : (`✨ צור וידאו (${totalCost} קרדיטים)`)}
                    </Button>
                </div>

                <div className="lg:col-span-8 space-y-6">
                    <Card className="aspect-video bg-black/5 dark:bg-black/40 flex flex-col items-center justify-center relative overflow-hidden border-2 border-dashed border-muted">
                        {loading && (
                            <div className="absolute inset-0 z-20 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6" />
                                <h3 className="text-xl font-bold mb-2">{statusMsg}</h3>
                                <div className="w-full max-w-md mt-4">
                                    <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} /></div>
                                    <p className="text-sm text-muted-foreground mt-1">{progress}%</p>
                                </div>
                                <div className="w-full max-w-md space-y-3 mt-6">
                                    {steps.map((s) => {
                                        const status = getStepStatus(s.key);
                                        return (
                                            <div key={s.key} className={`flex items-center gap-3 ${status === "active" ? "text-primary" : status === "completed" ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                                                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${status === "active" ? "bg-primary animate-pulse" : status === "completed" ? "bg-green-500" : "bg-muted"}`} />
                                                <span className="font-medium">{s.label}</span>
                                                <span className="text-xs opacity-70">({s.detail})</span>
                                                {status === "completed" && <span className="mr-auto">✓</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        {mainVideoUrl && !loading ? (<video src={mainVideoUrl} controls autoPlay loop className="w-full h-full object-contain bg-black" />) : !loading ? (
                            <div className="text-center text-muted-foreground"><div className="text-6xl mb-4 opacity-20">🎬</div><p className="text-lg">הוידאו המוכן יופיע כאן</p></div>
                        ) : null}
                    </Card>

                    {step === "done" && (
                        <>
                            <div className="flex gap-4">
                                {mainVideoUrl && (<Button className="flex-1" onClick={() => window.open(mainVideoUrl, "_blank")}>⬇️ הורד וידאו ראשי</Button>)}
                                <Button className="flex-1" variant="outline" onClick={() => { setStep("idle"); setMainVideoUrl(null); setGeneratedImages([]); setSceneVideoUrls([]); setPrompt(""); setProgress(0); }}>🔄 צור וידאו חדש</Button>
                            </div>
                            {(generatedImages.length > 0 || sceneVideoUrls.length > 0) && (
                                <Card className="p-5">
                                    <Label className="text-lg font-semibold mb-4 block">סצנות שנוצרו ({generatedImages.length})</Label>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {generatedImages.map((img, i) => (
                                            <div key={i} className="space-y-2">
                                                <div className="relative aspect-video rounded-lg overflow-hidden border">
                                                    <img src={img} alt={`סצנה ${i + 1}`} className="w-full h-full object-cover" />
                                                    <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">סצנה {i + 1}</div>
                                                </div>
                                                {sceneVideoUrls[i] && (<video src={sceneVideoUrls[i]} controls className="w-full aspect-video rounded-lg border" />)}
                                                <div className="flex gap-1">
                                                    <Button size="sm" variant="ghost" className="flex-1 text-xs" onClick={() => window.open(img, "_blank")}>🖼️ תמונה</Button>
                                                    {sceneVideoUrls[i] && (<Button size="sm" variant="ghost" className="flex-1 text-xs" onClick={() => window.open(sceneVideoUrls[i], "_blank")}>🎬 וידאו</Button>)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}