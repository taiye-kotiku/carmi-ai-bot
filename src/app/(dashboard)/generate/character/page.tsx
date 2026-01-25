// src/app/(dashboard)/generate/character/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
    Users,
    Wand2,
    Loader2,
    Download,
    Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { CharacterSelector } from "@/components/features/character-selector";
import { CreateCharacterModal } from "@/components/features/create-character-modal";
import { Character } from "@/types/database";
import { toast } from "sonner";

const ASPECT_RATIOS = [
    { value: "1:1", label: "ריבועי", icon: "⬜" },
    { value: "16:9", label: "רחב", icon: "🖼️" },
    { value: "9:16", label: "סטורי", icon: "📱" },
    { value: "4:3", label: "קלאסי", icon: "📺" },
];

export default function CharacterGenerationPage() {
    const searchParams = useSearchParams();
    const preselectedId = searchParams.get("id");

    const [characters, setCharacters] = useState<Character[]>([]);
    const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
    const [prompt, setPrompt] = useState("");
    const [aspectRatio, setAspectRatio] = useState("1:1");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectorKey, setSelectorKey] = useState(0);

    // Fetch characters and preselect if ID in URL
    useEffect(() => {
        async function fetchAndSelect() {
            try {
                const res = await fetch("/api/characters");
                if (res.ok) {
                    const data = await res.json();
                    setCharacters(data);

                    if (preselectedId) {
                        const found = data.find((c: Character) => c.id === preselectedId);
                        if (found) {
                            setSelectedCharacter(found);
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to fetch characters:", err);
            }
        }
        fetchAndSelect();
    }, [preselectedId]);

    const handleGenerate = async () => {
        if (!selectedCharacter) {
            toast.error("נא לבחור דמות");
            return;
        }
        if (!prompt.trim()) {
            toast.error("נא להזין תיאור לתמונה");
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const response = await fetch("/api/generate/character-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    character_id: selectedCharacter.id,
                    prompt,
                    aspect_ratio: aspectRatio,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error);
            }

            const { jobId } = await response.json();

            // Poll for result
            let attempts = 0;
            while (attempts < 60) {
                await new Promise((r) => setTimeout(r, 2000));

                const statusRes = await fetch(`/api/jobs/${jobId}`);
                const status = await statusRes.json();

                if (status.status === "completed") {
                    setResult(status.result.images[0]);
                    toast.success("התמונה נוצרה! 🎨");
                    break;
                }

                if (status.status === "failed") {
                    throw new Error(status.error);
                }

                attempts++;
            }

            if (attempts >= 60) {
                throw new Error("הזמן הקצוב חלף");
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
            a.download = `${selectedCharacter?.name || "character"}-${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            toast.success("התמונה הורדה!");
        } catch {
            toast.error("שגיאה בהורדה");
        }
    };

    const refreshCharacters = useCallback(() => {
        setSelectorKey((k) => k + 1);
    }, []);

    return (
        <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="h-12 w-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                        <Users className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">יצירה עם דמות</h1>
                        <p className="text-gray-600">
                            צור תמונות עם הדמות שלך בכל מצב שתרצה
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Input Column */}
                <div className="space-y-6">
                    <Card>
                        <CardContent className="p-6 space-y-6">
                            {/* Character Selector */}
                            <CharacterSelector
                                key={selectorKey}
                                selectedId={selectedCharacter?.id}
                                onSelect={setSelectedCharacter}
                                onCreateNew={() => setShowCreateModal(true)}
                            />

                            {/* Selected character info */}
                            {selectedCharacter && (
                                <div className="bg-indigo-50 rounded-lg p-3 flex items-center gap-3">
                                    <img
                                        src={selectedCharacter.thumbnail_url || selectedCharacter.reference_images[0]}
                                        alt={selectedCharacter.name}
                                        className="w-12 h-12 rounded-lg object-cover"
                                    />
                                    <div>
                                        <p className="font-medium">{selectedCharacter.name}</p>
                                        <p className="text-sm text-gray-600">
                                            {selectedCharacter.reference_images.length} תמונות ייחוס
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Prompt */}
                            <div>
                                <Label className="text-base">מה הדמות עושה?</Label>
                                <Textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder={
                                        selectedCharacter
                                            ? `לדוגמה: ${selectedCharacter.name} יושב/ת בבית קפה פריזאי, אור בוקר רך...`
                                            : "בחר דמות קודם..."
                                    }
                                    rows={4}
                                    className="mt-2"
                                    disabled={!selectedCharacter}
                                />
                            </div>

                            {/* Aspect Ratio */}
                            <div>
                                <Label className="text-base">יחס תמונה</Label>
                                <div className="grid grid-cols-4 gap-2 mt-2">
                                    {ASPECT_RATIOS.map((ratio) => (
                                        <button
                                            key={ratio.value}
                                            onClick={() => setAspectRatio(ratio.value)}
                                            className={`p-2 rounded-lg border text-sm flex flex-col items-center gap-1 transition-colors ${aspectRatio === ratio.value
                                                ? "border-purple-500 bg-purple-50 text-purple-700"
                                                : "border-gray-200 hover:border-gray-300"
                                                }`}
                                        >
                                            <span>{ratio.icon}</span>
                                            <span className="text-xs">{ratio.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Generate Button */}
                            <Button
                                onClick={handleGenerate}
                                disabled={loading || !selectedCharacter || !prompt.trim()}
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
                                        צור תמונה עם הדמות
                                    </>
                                )}
                            </Button>

                            <p className="text-sm text-indigo-600 text-center">
                                עלות: 2 קרדיטים תמונה
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
                                        <Loader2 className="h-12 w-12 animate-spin text-indigo-500 mx-auto mb-4" />
                                        <p className="text-gray-600">יוצר את התמונה עם הדמות שלך...</p>
                                        <p className="text-sm text-gray-400 mt-1">
                                            זה יכול לקחת עד דקה
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
                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        onClick={handleDownload}
                                    >
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

            {/* Create Character Modal */}
            <CreateCharacterModal
                open={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onCreated={refreshCharacters}
            />
        </div>
    );
}