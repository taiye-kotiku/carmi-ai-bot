// src/app/(dashboard)/generate/character-video/page.tsx
"use client";

import { useState, useEffect } from "react";
import {
    Video,
    Wand2,
    Loader2,
    Download,
    Play,
    Pause,
    Sparkles,
    Edit3,
    Plus,
    Trash2,
    Check,
    X,
    Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { CharacterSelector } from "@/components/features/character-selector";
import { CreateCharacterModal } from "@/components/features/create-character-modal";
import { Character } from "@/types/database";
import { toast } from "sonner";

const STYLES = [
    { value: "storytelling", label: "סיפורי", icon: "📖", desc: "סיפור עם התחלה, אמצע וסוף" },
    { value: "educational", label: "חינוכי", icon: "📚", desc: "הסבר צעד אחר צעד" },
    { value: "promotional", label: "שיווקי", icon: "📣", desc: "הצגת מוצר או שירות" },
    { value: "lifestyle", label: "לייפסטייל", icon: "✨", desc: "רגעים מהחיים" },
];

const ASPECT_RATIOS = [
    { value: "9:16", label: "סטורי", icon: "📱" },
    { value: "1:1", label: "ריבועי", icon: "⬜" },
    { value: "16:9", label: "רחב", icon: "🖼️" },
    { value: "4:5", label: "פיד", icon: "📷" },
];

const TRANSITIONS = [
    { value: "fade", label: "דעיכה" },
    { value: "slide", label: "החלקה" },
    { value: "zoom", label: "זום" },
    { value: "none", label: "ללא" },
];

const SCENE_COUNTS = [3, 4, 5, 6, 7, 8];
const DURATIONS = [2, 3, 4, 5];

export default function CharacterVideoPage() {
    // Character state
    const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectorKey, setSelectorKey] = useState(0);

    // Content state
    const [topic, setTopic] = useState("");
    const [customScenes, setCustomScenes] = useState<string[]>([]);
    const [isCustomMode, setIsCustomMode] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editText, setEditText] = useState("");

    // Settings state
    const [style, setStyle] = useState("storytelling");
    const [aspectRatio, setAspectRatio] = useState("9:16");
    const [transitionStyle, setTransitionStyle] = useState("fade");
    const [sceneCount, setSceneCount] = useState(5);
    const [sceneDuration, setSceneDuration] = useState(3);

    // Generation state
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<{
        videoUrl: string;
        imageUrls: string[];
        scenes: string[];
    } | null>(null);

    // Video player state
    const [isPlaying, setIsPlaying] = useState(false);

    async function handleGenerate() {
        if (!selectedCharacter) {
            toast.error("נא לבחור דמות");
            return;
        }

        if (!isCustomMode && !topic.trim()) {
            toast.error("נא להזין נושא לסרטון");
            return;
        }

        if (isCustomMode && customScenes.filter(s => s.trim()).length < 2) {
            toast.error("נא להזין לפחות 2 סצנות");
            return;
        }

        setLoading(true);
        setResult(null);
        setProgress(0);

        try {
            const response = await fetch("/api/generate/character-video", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    character_id: selectedCharacter.id,
                    topic: isCustomMode ? undefined : topic,
                    custom_scenes: isCustomMode ? customScenes.filter(s => s.trim()) : undefined,
                    scene_count: isCustomMode ? customScenes.filter(s => s.trim()).length : sceneCount,
                    style,
                    aspect_ratio: aspectRatio,
                    transition_style: transitionStyle,
                    scene_duration: sceneDuration,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error);
            }

            const { jobId } = await response.json();

            // Poll for result with progress updates
            let attempts = 0;
            while (attempts < 120) { // 4 minutes timeout
                await new Promise((r) => setTimeout(r, 2000));

                const statusRes = await fetch(`/api/jobs/${jobId}`);
                const status = await statusRes.json();

                setProgress(status.progress || 0);

                if (status.status === "completed") {
                    setResult({
                        videoUrl: status.result.videoUrl,
                        imageUrls: status.result.imageUrls,
                        scenes: status.result.scenes,
                    });
                    toast.success("הסרטון נוצר בהצלחה! 🎬");
                    break;
                }

                if (status.status === "failed") {
                    throw new Error(status.error);
                }

                attempts++;
            }

            if (attempts >= 120) {
                throw new Error("הזמן הקצוב חלף");
            }
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleDownload() {
        if (!result?.videoUrl) return;

        try {
            const response = await fetch(result.videoUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${selectedCharacter?.name || "character"}-video-${Date.now()}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            toast.success("הסרטון הורד!");
        } catch {
            toast.error("שגיאה בהורדה");
        }
    }

    function addScene() {
        setCustomScenes([...customScenes, ""]);
        setEditingIndex(customScenes.length);
        setEditText("");
    }

    function saveScene(index: number) {
        if (!editText.trim()) {
            removeScene(index);
            return;
        }
        const newScenes = [...customScenes];
        newScenes[index] = editText;
        setCustomScenes(newScenes);
        setEditingIndex(null);
        setEditText("");
    }

    function removeScene(index: number) {
        setCustomScenes(customScenes.filter((_, i) => i !== index));
        setEditingIndex(null);
    }

    const numScenes = isCustomMode ? customScenes.filter(s => s.trim()).length : sceneCount;
    const totalCredits = numScenes * 2 + 1;

    return (
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="h-12 w-12 bg-violet-100 rounded-xl flex items-center justify-center">
                        <Video className="h-6 w-6 text-violet-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">סרטון דמות</h1>
                        <p className="text-gray-600">
                            צור סרטון סליידשו עם הדמות שלך בסצנות שונות
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
                                <div className="bg-violet-50 rounded-lg p-3 flex items-center gap-3">
                                    <img
                                        src={selectedCharacter.thumbnail_url || selectedCharacter.reference_images?.[0]}
                                        alt={selectedCharacter.name}
                                        className="w-12 h-12 rounded-lg object-cover"
                                    />
                                    <div>
                                        <p className="font-medium">{selectedCharacter.name}</p>
                                        <p className="text-sm text-gray-600">
                                            {(selectedCharacter.reference_images || []).length} תמונות ייחוס
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Mode Toggle */}
                            <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                                <button
                                    onClick={() => setIsCustomMode(false)}
                                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${!isCustomMode
                                        ? "bg-white shadow text-violet-700"
                                        : "text-gray-600 hover:text-gray-900"
                                        }`}
                                >
                                    <Sparkles className="inline-block w-4 h-4 ml-1" />
                                    יצירה עם AI
                                </button>
                                <button
                                    onClick={() => setIsCustomMode(true)}
                                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${isCustomMode
                                        ? "bg-white shadow text-violet-700"
                                        : "text-gray-600 hover:text-gray-900"
                                        }`}
                                >
                                    <Edit3 className="inline-block w-4 h-4 ml-1" />
                                    סצנות ידניות
                                </button>
                            </div>

                            {/* AI Mode */}
                            {!isCustomMode && (
                                <>
                                    <div>
                                        <Label className="text-base">נושא הסרטון</Label>
                                        <Textarea
                                            value={topic}
                                            onChange={(e) => setTopic(e.target.value)}
                                            placeholder={
                                                selectedCharacter
                                                    ? `לדוגמה: יום בחיי ${selectedCharacter.name}, איך ${selectedCharacter.name} מתחיל/ה את הבוקר...`
                                                    : "בחר דמות קודם..."
                                            }
                                            rows={3}
                                            className="mt-2"
                                            disabled={!selectedCharacter}
                                        />
                                    </div>

                                    {/* Style */}
                                    <div>
                                        <Label className="text-base">סגנון</Label>
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            {STYLES.map((s) => (
                                                <button
                                                    key={s.value}
                                                    onClick={() => setStyle(s.value)}
                                                    className={`p-3 rounded-lg border text-right transition-colors ${style === s.value
                                                        ? "border-violet-500 bg-violet-50"
                                                        : "border-gray-200 hover:border-gray-300"
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span>{s.icon}</span>
                                                        <span className="font-medium">{s.label}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-500">{s.desc}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Scene Count */}
                                    <div>
                                        <Label className="text-base">מספר סצנות</Label>
                                        <div className="flex gap-2 mt-2">
                                            {SCENE_COUNTS.map((count) => (
                                                <button
                                                    key={count}
                                                    onClick={() => setSceneCount(count)}
                                                    className={`w-10 h-10 rounded-lg border text-sm font-medium transition-colors ${sceneCount === count
                                                        ? "border-violet-500 bg-violet-50 text-violet-700"
                                                        : "border-gray-200 hover:border-gray-300"
                                                        }`}
                                                >
                                                    {count}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Custom Mode */}
                            {isCustomMode && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <Label className="text-base">סצנות ({customScenes.length})</Label>
                                        <Button size="sm" variant="outline" onClick={addScene}>
                                            <Plus className="w-4 h-4 ml-1" />
                                            הוסף סצנה
                                        </Button>
                                    </div>
                                    <div className="space-y-2 max-h-[250px] overflow-y-auto">
                                        {customScenes.map((scene, index) => (
                                            <div
                                                key={index}
                                                className="flex items-start gap-2 bg-gray-50 rounded-lg p-2"
                                            >
                                                <span className="w-6 h-6 bg-violet-100 text-violet-700 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 mt-1">
                                                    {index + 1}
                                                </span>
                                                {editingIndex === index ? (
                                                    <>
                                                        <Textarea
                                                            value={editText}
                                                            onChange={(e) => setEditText(e.target.value)}
                                                            placeholder="תאר את הסצנה: מיקום, פעולה, תאורה, אווירה..."
                                                            rows={2}
                                                            className="flex-1 text-sm"
                                                            autoFocus
                                                        />
                                                        <div className="flex flex-col gap-1">
                                                            <button
                                                                onClick={() => saveScene(index)}
                                                                className="p-1.5 bg-green-100 text-green-600 rounded hover:bg-green-200"
                                                            >
                                                                <Check className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setEditingIndex(null);
                                                                    if (!scene) removeScene(index);
                                                                }}
                                                                className="p-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="flex-1 text-sm py-1 text-gray-700">
                                                            {scene || "סצנה ריקה"}
                                                        </p>
                                                        <div className="flex gap-1">
                                                            <button
                                                                onClick={() => {
                                                                    setEditingIndex(index);
                                                                    setEditText(scene);
                                                                }}
                                                                className="p-1.5 text-gray-400 hover:text-gray-600"
                                                            >
                                                                <Edit3 className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => removeScene(index)}
                                                                className="p-1.5 text-gray-400 hover:text-red-500"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                        {customScenes.length === 0 && (
                                            <div className="text-center py-8 text-gray-400">
                                                <p>לחץ על "הוסף סצנה" כדי להתחיל</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Video Settings */}
                            <div className="grid grid-cols-2 gap-4">
                                {/* Aspect Ratio */}
                                <div>
                                    <Label className="text-sm">יחס תמונה</Label>
                                    <div className="grid grid-cols-2 gap-1 mt-1">
                                        {ASPECT_RATIOS.map((ratio) => (
                                            <button
                                                key={ratio.value}
                                                onClick={() => setAspectRatio(ratio.value)}
                                                className={`p-2 rounded border text-xs flex items-center justify-center gap-1 transition-colors ${aspectRatio === ratio.value
                                                    ? "border-violet-500 bg-violet-50"
                                                    : "border-gray-200"
                                                    }`}
                                            >
                                                <span>{ratio.icon}</span>
                                                <span>{ratio.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Transition */}
                                <div>
                                    <Label className="text-sm">מעבר</Label>
                                    <div className="grid grid-cols-2 gap-1 mt-1">
                                        {TRANSITIONS.map((t) => (
                                            <button
                                                key={t.value}
                                                onClick={() => setTransitionStyle(t.value)}
                                                className={`p-2 rounded border text-xs transition-colors ${transitionStyle === t.value
                                                    ? "border-violet-500 bg-violet-50"
                                                    : "border-gray-200"
                                                    }`}
                                            >
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Duration per scene */}
                            <div>
                                <Label className="text-sm">משך כל סצנה (שניות)</Label>
                                <div className="flex gap-2 mt-1">
                                    {DURATIONS.map((d) => (
                                        <button
                                            key={d}
                                            onClick={() => setSceneDuration(d)}
                                            className={`w-10 h-8 rounded border text-sm transition-colors ${sceneDuration === d
                                                ? "border-violet-500 bg-violet-50"
                                                : "border-gray-200"
                                                }`}
                                        >
                                            {d}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Generate Button */}
                            <Button
                                onClick={handleGenerate}
                                disabled={
                                    loading ||
                                    !selectedCharacter ||
                                    (!isCustomMode && !topic.trim()) ||
                                    (isCustomMode && customScenes.filter(s => s.trim()).length < 2)
                                }
                                className="w-full"
                                size="lg"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin ml-2" />
                                        יוצר סרטון... {progress}%
                                    </>
                                ) : (
                                    <>
                                        <Wand2 className="h-5 w-5 ml-2" />
                                        צור סרטון דמות
                                    </>
                                )}
                            </Button>

                            <div className="text-center">
                                <p className="text-sm text-violet-600">
                                    עלות: {numScenes * 2} קרדיטים תמונה + 1 קרדיט וידאו
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    סה"כ {numScenes} סצנות × {sceneDuration} שניות = {numScenes * sceneDuration} שניות
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Result Column */}
                <div>
                    <Card className="h-full">
                        <CardContent className="p-6 h-full flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-medium">תוצאה</h3>
                                {result?.videoUrl && (
                                    <Button size="sm" variant="outline" onClick={handleDownload}>
                                        <Download className="w-4 h-4 ml-1" />
                                        הורד
                                    </Button>
                                )}
                            </div>

                            {/* Loading State */}
                            {loading && (
                                <div className="flex-1 bg-gray-100 rounded-lg flex flex-col items-center justify-center min-h-[500px]">
                                    <Loader2 className="h-12 w-12 animate-spin text-violet-500 mb-4" />
                                    <p className="text-gray-600 mb-2">יוצר את הסרטון שלך...</p>

                                    {/* Progress bar */}
                                    <div className="w-48 bg-gray-200 rounded-full h-2 mb-2">
                                        <div
                                            className="bg-violet-500 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    <p className="text-sm text-gray-400">{progress}%</p>

                                    <div className="mt-4 text-xs text-gray-400 text-center">
                                        <p>שלב 1: יצירת סצנות (AI)</p>
                                        <p>שלב 2: יצירת תמונות דמות</p>
                                        <p>שלב 3: עריכת הסרטון</p>
                                    </div>
                                </div>
                            )}

                            {/* Result */}
                            {result && !loading && (
                                <div className="space-y-4">
                                    {/* Video Player */}
                                    <div className="relative rounded-lg overflow-hidden bg-black">
                                        <video
                                            src={result.videoUrl}
                                            className="w-full"
                                            controls
                                            poster={result.imageUrls[0]}
                                        />
                                    </div>

                                    {/* Scene Thumbnails */}
                                    <div>
                                        <p className="text-sm font-medium mb-2">סצנות ({result.imageUrls.length})</p>
                                        <div className="flex gap-2 overflow-x-auto pb-2">
                                            {result.imageUrls.map((url, index) => (
                                                <div key={index} className="flex-shrink-0">
                                                    <img
                                                        src={url}
                                                        alt={`Scene ${index + 1}`}
                                                        className="w-20 h-28 object-cover rounded-lg border"
                                                    />
                                                    <p className="text-xs text-center mt-1 text-gray-500">
                                                        {index + 1}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Scene Descriptions */}
                                    {result.scenes && (
                                        <div className="bg-gray-50 rounded-lg p-3 max-h-[150px] overflow-y-auto">
                                            <p className="text-sm font-medium mb-2">תיאורי סצנות:</p>
                                            <div className="space-y-2">
                                                {result.scenes.map((scene, index) => (
                                                    <div key={index} className="flex gap-2 text-xs">
                                                        <span className="w-5 h-5 bg-violet-100 text-violet-700 rounded-full flex items-center justify-center flex-shrink-0">
                                                            {index + 1}
                                                        </span>
                                                        <p className="text-gray-600">{scene}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Empty State */}
                            {!loading && !result && (
                                <div className="flex-1 bg-gray-50 rounded-lg flex items-center justify-center border-2 border-dashed min-h-[500px]">
                                    <div className="text-center text-gray-400">
                                        <Video className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                        <p>הסרטון יופיע כאן</p>
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
                onCreated={() => setSelectorKey((k) => k + 1)}
            />
        </div>
    );
}