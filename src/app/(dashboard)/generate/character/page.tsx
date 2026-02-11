// src/app/(dashboard)/generate/character/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/types/database";
import { CREDIT_COSTS } from "@/lib/config/credits";

type Character = Tables<"characters">;

const PRESET_PROMPTS = [
    {
        label: "צילום מקצועי",
        prompt:
            "תמונת פורטרט מקצועית, תאורת סטודיו, רקע נייטרלי נקי, פוקוס חד, איכות גבוהה",
    },
    {
        label: "סגנון עסקי",
        prompt:
            "פורטרט עסקי מקצועי, לבוש בחליפה, רקע משרד, תנוחה בטוחה, צילום קורפורטיבי",
    },
    {
        label: "פיג'מה",
        prompt:
            "wearing cozy pajamas, relaxed at home, warm lighting, comfortable setting, smiling",
    },
    {
        label: "חוף הים",
        prompt:
            "צילום קז'ואל בחוף, אור שעת הזהב, רקע אוקיינוס, חיוך רגוע, תאורה טבעית",
    },
    {
        label: "סגנון אמנותי",
        prompt:
            "פורטרט אמנותי, תאורה דרמטית, מצב רוח קולנועי, עומק שדה רדוד, אווירה מרשימה",
    },
    {
        label: "ספורט",
        prompt:
            "athletic portrait, wearing sports clothing, gym or outdoor setting, energetic pose, dynamic lighting",
    },
    {
        label: "חג מולד",
        prompt:
            "פורטרט חגיגי, רקע קישוטי חג מולד, תאורה חמה ונעימה, לבוש בגדי חורף, עליז",
    },
    {
        label: "קזואל",
        prompt:
            "casual everyday photo, natural lighting, urban street background, relaxed pose, candid style",
    },
];

const SIZE_PRESETS = [
    { label: "ריבוע", width: 1024, height: 1024, icon: "[]" },
    { label: "פורטרט", width: 768, height: 1024, icon: "|" },
    { label: "נוף", width: 1024, height: 768, icon: "-" },
    { label: "רחב", width: 1280, height: 768, icon: "--" },
];

export default function CharacterGeneratePage() {
    const searchParams = useSearchParams();
    const preselectedId = searchParams.get("id");

    const [mounted, setMounted] = useState(false);
    const [characters, setCharacters] = useState<Character[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(preselectedId);
    const [prompt, setPrompt] = useState("");
    const [width, setWidth] = useState(1024);
    const [height, setHeight] = useState(1024);
    const [steps, setSteps] = useState(28);
    const [guidanceScale, setGuidanceScale] = useState(3.5);
    const [loraScale, setLoraScale] = useState(0.9);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImages, setGeneratedImages] = useState<
        { url: string; seed: number; prompt: string }[]
    >([]);
    const [error, setError] = useState<string | null>(null);
    const [showAdvanced, setShowAdvanced] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch("/api/characters");
                const data = await res.json();
                const readyChars = (data.characters || []).filter(
                    (c: Character) => c.status === "ready"
                );
                setCharacters(readyChars);

                if (
                    preselectedId &&
                    readyChars.some((c: Character) => c.id === preselectedId)
                ) {
                    setSelectedId(preselectedId);
                } else if (readyChars.length > 0 && !selectedId) {
                    setSelectedId(readyChars[0].id);
                }
            } catch (err) {
                console.error("Failed to load characters:", err);
            }
        }
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [preselectedId]);

    const selectedCharacter =
        characters.find((c) => c.id === selectedId) || null;

    const handleGenerate = useCallback(async () => {
        if (!selectedId || !prompt.trim()) return;

        setIsGenerating(true);
        setError(null);

        // Auto-inject trigger word
        const triggerWord =
            selectedCharacter?.trigger_word || "TOK";
        let finalPrompt = prompt.trim();

        if (!finalPrompt.toLowerCase().includes(triggerWord.toLowerCase())) {
            finalPrompt = `${triggerWord} person, ${finalPrompt}`;
        }

        try {
            const res = await fetch(
                `/api/characters/${selectedId}/image`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        prompt: finalPrompt,
                        width,
                        height,
                        num_inference_steps: steps,
                        guidance_scale: guidanceScale,
                        lora_scale: loraScale,
                    }),
                }
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Generation failed");
            }

            setGeneratedImages((prev) => [
                {
                    url: data.image_url,
                    seed: data.seed,
                    prompt: finalPrompt,
                },
                ...prev,
            ]);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Generation failed"
            );
        } finally {
            setIsGenerating(false);
        }
    }, [
        selectedId,
        selectedCharacter,
        prompt,
        width,
        height,
        steps,
        guidanceScale,
        loraScale,
    ]);

    if (!mounted) {
        return (
            <div className="container mx-auto p-6" dir="rtl">
                <div className="h-9 w-64 bg-muted animate-pulse rounded mb-8" />
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    <div className="lg:col-span-3 space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="h-24 bg-muted animate-pulse rounded-xl"
                            />
                        ))}
                    </div>
                    <div className="lg:col-span-2">
                        <div className="aspect-square bg-muted animate-pulse rounded-xl" />
                    </div>
                </div>
            </div>
        );
    }

    if (characters.length === 0) {
        return (
            <div className="container mx-auto p-6" dir="rtl">
                <h1 className="text-3xl font-bold mb-6">
                    יצירת תמונה עם דמות
                </h1>
                <Card className="p-12 text-center">
                    <h2 className="text-xl font-semibold mb-3">
                        אין דמויות מוכנות
                    </h2>
                    <p className="text-muted-foreground mb-6">
                        עליך ליצור ולאמן דמות לפני שתוכל ליצור תמונות
                    </p>
                    <Button asChild size="lg">
                        <a href="/characters">עבור לדף הדמויות</a>
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl" dir="rtl">
            <h1 className="text-3xl font-bold mb-2">
                יצירת תמונה עם דמות
            </h1>
            <p className="text-muted-foreground mb-8">
                בחר דמות, תאר את הסצנה, ואנחנו ניצור תמונה מותאמת אישית
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                {/* Controls */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Character Selector */}
                    <div className="space-y-3">
                        <Label className="text-base font-semibold">בחר דמות</Label>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                            {characters.map((char) => (
                                <button
                                    key={char.id}
                                    onClick={() => setSelectedId(char.id)}
                                    className={`relative rounded-xl overflow-hidden border-2 transition-all ${selectedId === char.id
                                        ? "border-primary shadow-lg ring-2 ring-primary/20"
                                        : "border-transparent hover:border-muted-foreground/30"
                                        }`}
                                >
                                    <div className="aspect-square">
                                        {char.image_urls && char.image_urls[0] ? (
                                            <img
                                                src={
                                                    char.image_urls[0]
                                                }
                                                alt={char.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-muted flex items-center justify-center text-2xl">
                                                ?
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-2 text-center">
                                        <p className="text-sm font-medium truncate">
                                            {char.name}
                                        </p>
                                    </div>
                                    {selectedId === char.id && (
                                        <div className="absolute top-2 left-2 bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs shadow">
                                            V
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Prompt */}
                    <div className="space-y-3">
                        <Label className="text-base font-semibold">
                            תיאור הסצנה
                        </Label>
                        <Textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="תאר את הסצנה באנגלית, לדוגמה: in pajamas, sitting on a couch, cozy lighting"
                            rows={4}
                            dir="ltr"
                            className="font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                            הטריגר &quot;
                            {selectedCharacter?.trigger_word || "TOK"}
                            &quot; יתווסף אוטומטית. פשוט תאר את הסצנה באנגלית.
                        </p>
                    </div>

                    {/* Preset prompts */}
                    <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">
                            או בחר תבנית מוכנה:
                        </Label>
                        <div className="flex flex-wrap gap-2">
                            {PRESET_PROMPTS.map((preset) => (
                                <button
                                    key={preset.label}
                                    onClick={() => setPrompt(preset.prompt)}
                                    className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${prompt === preset.prompt
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-background hover:bg-muted border-border"
                                        }`}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Size presets */}
                    <div className="space-y-3">
                        <Label className="text-base font-semibold">
                            גודל תמונה
                        </Label>
                        <div className="grid grid-cols-4 gap-2">
                            {SIZE_PRESETS.map((preset) => (
                                <button
                                    key={preset.label}
                                    onClick={() => {
                                        setWidth(preset.width);
                                        setHeight(preset.height);
                                    }}
                                    className={`p-3 rounded-lg border-2 text-center transition-all ${width === preset.width &&
                                        height === preset.height
                                        ? "border-primary bg-primary/5"
                                        : "border-border hover:border-primary/50"
                                        }`}
                                >
                                    <div className="text-lg mb-1">{preset.icon}</div>
                                    <div className="text-xs font-medium">
                                        {preset.label}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">
                                        {preset.width}x{preset.height}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Advanced settings */}
                    <div className="border rounded-xl overflow-hidden">
                        <button
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="w-full p-4 text-right flex items-center justify-between hover:bg-muted/50 transition-colors"
                        >
                            <span className="font-semibold text-sm">
                                הגדרות מתקדמות
                            </span>
                            <span
                                className={`transition-transform ${showAdvanced ? "rotate-180" : ""
                                    }`}
                            >
                                V
                            </span>
                        </button>

                        {showAdvanced && (
                            <div className="p-4 border-t space-y-5">
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <Label className="text-sm">
                                            צעדי הסקה (Steps)
                                        </Label>
                                        <Badge variant="outline">{steps}</Badge>
                                    </div>
                                    <Slider
                                        value={[steps]}
                                        onValueChange={([v]) => setSteps(v)}
                                        min={10}
                                        max={50}
                                        step={1}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        ערך גבוה = איכות טובה יותר, זמן ארוך יותר
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <Label className="text-sm">
                                            Guidance Scale
                                        </Label>
                                        <Badge variant="outline">
                                            {guidanceScale}
                                        </Badge>
                                    </div>
                                    <Slider
                                        value={[guidanceScale]}
                                        onValueChange={([v]) => setGuidanceScale(v)}
                                        min={1}
                                        max={10}
                                        step={0.5}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        ערך גבוה = דביקות גבוהה לפרומפט, פחות
                                        יצירתיות
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <Label className="text-sm">
                                            עוצמת הדמות (LoRA Scale)
                                        </Label>
                                        <Badge variant="outline">{loraScale}</Badge>
                                    </div>
                                    <Slider
                                        value={[loraScale]}
                                        onValueChange={([v]) => setLoraScale(v)}
                                        min={0.1}
                                        max={1.5}
                                        step={0.05}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        ערך גבוה = הדמות דומינטנית יותר. מומלץ:
                                        0.8-1.0
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Generate button */}
                    <Button
                        onClick={handleGenerate}
                        disabled={
                            isGenerating || !selectedId || !prompt.trim()
                        }
                        className="w-full text-lg py-6"
                        size="lg"
                    >
                        {isGenerating ? (
                            <span className="flex items-center gap-3">
                                <span className="animate-spin">|</span>
                                מייצר תמונה... (10-30 שניות)
                            </span>
                        ) : (
                            <span className="flex items-center gap-2">
                                צור תמונה
                                <span className="text-sm opacity-80">
                                    ({CREDIT_COSTS.image_generation} קרדיטים)
                                </span>
                            </span>
                        )}
                    </Button>

                    {/* Error */}
                    {error && (
                        <div className="bg-destructive/10 text-destructive rounded-lg p-4">
                            <p className="font-medium">שגיאה</p>
                            <p className="text-sm mt-1">{error}</p>
                        </div>
                    )}
                </div>

                {/* Results */}
                <div className="lg:col-span-2 space-y-4">
                    <Label className="text-base font-semibold">
                        תוצאות
                        {generatedImages.length > 0 && (
                            <span className="text-muted-foreground font-normal text-sm mr-2">
                                ({generatedImages.length})
                            </span>
                        )}
                    </Label>

                    <Card className="aspect-square overflow-hidden flex items-center justify-center bg-muted/30">
                        {isGenerating ? (
                            <div className="text-center space-y-4 p-8">
                                <div className="text-4xl animate-bounce">...</div>
                                <p className="text-lg font-medium animate-pulse">
                                    מייצר תמונה...
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    זה לוקח בדרך כלל 10-30 שניות
                                </p>
                            </div>
                        ) : generatedImages.length > 0 ? (
                            <img
                                src={generatedImages[0].url}
                                alt="Generated image"
                                className="w-full h-full object-contain"
                            />
                        ) : (
                            <div className="text-center p-8 space-y-3">
                                <div className="text-3xl">_</div>
                                <p className="text-muted-foreground">
                                    התמונות שלך יופיעו כאן
                                </p>
                            </div>
                        )}
                    </Card>

                    {generatedImages.length > 0 && !isGenerating && (
                        <div className="flex gap-2">
                            <Button
                                asChild
                                variant="outline"
                                className="flex-1"
                                size="sm"
                            >
                                <a
                                    href={generatedImages[0].url}
                                    download={`character-${Date.now()}.png`}
                                    target="_blank"
                                >
                                    הורד
                                </a>
                            </Button>
                            <Button
                                variant="outline"
                                className="flex-1"
                                size="sm"
                                onClick={() => {
                                    window.open(generatedImages[0].url, "_blank");
                                }}
                            >
                                פתח בגודל מלא
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                    await navigator.clipboard.writeText(
                                        generatedImages[0].url
                                    );
                                }}
                            >
                                העתק
                            </Button>
                        </div>
                    )}

                    {generatedImages.length > 1 && (
                        <div className="space-y-2">
                            <Label className="text-sm text-muted-foreground">
                                תמונות קודמות
                            </Label>
                            <div className="grid grid-cols-3 gap-2">
                                {generatedImages.slice(1).map((img, i) => (
                                    <button
                                        key={i}
                                        onClick={() => {
                                            setGeneratedImages((prev) => {
                                                const newArr = [...prev];
                                                const item = newArr.splice(i + 1, 1)[0];
                                                newArr.unshift(item);
                                                return newArr;
                                            });
                                        }}
                                        className="aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-all"
                                    >
                                        <img
                                            src={img.url}
                                            alt={`Generation ${i + 2}`}
                                            className="w-full h-full object-cover"
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}