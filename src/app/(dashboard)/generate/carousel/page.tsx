// src/app/(dashboard)/generate/carousel/page.tsx
"use client";

import { useState } from "react";
import {
    LayoutGrid,
    Wand2,
    Loader2,
    Download,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    Edit3,
    Check,
    X,
    Plus,
    Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CAROUSEL_TEMPLATES, CarouselTemplate, getTemplatesByCategory } from "@/lib/carousel/templates";

const STYLES = [
    { value: "educational", label: "חינוכי", icon: "📚" },
    { value: "promotional", label: "שיווקי", icon: "📣" },
    { value: "storytelling", label: "סיפורי", icon: "📖" },
    { value: "tips", label: "טיפים", icon: "💡" },
];

const CATEGORIES = [
    { value: "all", label: "הכל" },
    { value: "gradient", label: "גרדיאנט" },
    { value: "dark", label: "כהה" },
    { value: "tech", label: "טכנולוגי" },
    { value: "office", label: "משרדי" },
];

const SLIDE_COUNTS = [3, 4, 5, 6, 7, 8];

export default function CarouselGenerationPage() {
    // Form state
    const [topic, setTopic] = useState("");
    const [customSlides, setCustomSlides] = useState<string[]>([]);
    const [isCustomMode, setIsCustomMode] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<string>("T_02");
    const [slideCount, setSlideCount] = useState(5);
    const [style, setStyle] = useState("educational");
    const [useBrand, setUseBrand] = useState(false);
    const [categoryFilter, setCategoryFilter] = useState("all");

    // Generation state
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<string[]>([]);
    const [currentSlide, setCurrentSlide] = useState(0);

    // Custom slides editing
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editText, setEditText] = useState("");

    const filteredTemplates = getTemplatesByCategory(categoryFilter);

    async function handleGenerate() {
        if (!isCustomMode && !topic.trim()) {
            toast.error("נא להזין נושא לקרוסלה");
            return;
        }

        if (isCustomMode && customSlides.length < 2) {
            toast.error("נא להזין לפחות 2 שקופיות");
            return;
        }

        setLoading(true);
        setResults([]);
        setCurrentSlide(0);

        try {
            const response = await fetch("/api/generate/carousel", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    topic: isCustomMode ? undefined : topic,
                    slides: isCustomMode ? customSlides : undefined,
                    template_id: selectedTemplate,
                    slide_count: isCustomMode ? customSlides.length : slideCount,
                    style,
                    use_brand: useBrand,
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
                    setResults(status.result.images);
                    toast.success("הקרוסלה נוצרה בהצלחה! 🎨");
                    break;
                }

                if (status.status === "failed") {
                    throw new Error(status.error);
                }

                attempts++;
            }
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleDownloadAll() {
        if (!results.length) return;

        for (let i = 0; i < results.length; i++) {
            try {
                const response = await fetch(results[i]);
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `carousel-slide-${i + 1}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            } catch {
                console.error(`Failed to download slide ${i + 1}`);
            }
        }
        toast.success("כל השקופיות הורדו!");
    }

    function addSlide() {
        setCustomSlides([...customSlides, ""]);
        setEditingIndex(customSlides.length);
        setEditText("");
    }

    function saveSlide(index: number) {
        if (!editText.trim()) {
            removeSlide(index);
            return;
        }
        const newSlides = [...customSlides];
        newSlides[index] = editText;
        setCustomSlides(newSlides);
        setEditingIndex(null);
        setEditText("");
    }

    function removeSlide(index: number) {
        setCustomSlides(customSlides.filter((_, i) => i !== index));
        setEditingIndex(null);
    }

    return (
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="h-12 w-12 bg-pink-100 rounded-xl flex items-center justify-center">
                        <LayoutGrid className="h-6 w-6 text-pink-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">יצירת קרוסלה</h1>
                        <p className="text-gray-600">
                            צור קרוסלה מרהיבה לרשתות החברתיות
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Input Column */}
                <div className="space-y-6">
                    <Card>
                        <CardContent className="p-6 space-y-6">
                            {/* Mode Toggle */}
                            <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                                <button
                                    onClick={() => setIsCustomMode(false)}
                                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${!isCustomMode
                                            ? "bg-white shadow text-purple-700"
                                            : "text-gray-600 hover:text-gray-900"
                                        }`}
                                >
                                    <Sparkles className="inline-block w-4 h-4 ml-1" />
                                    יצירה עם AI
                                </button>
                                <button
                                    onClick={() => setIsCustomMode(true)}
                                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${isCustomMode
                                            ? "bg-white shadow text-purple-700"
                                            : "text-gray-600 hover:text-gray-900"
                                        }`}
                                >
                                    <Edit3 className="inline-block w-4 h-4 ml-1" />
                                    כתיבה ידנית
                                </button>
                            </div>

                            {/* AI Mode */}
                            {!isCustomMode && (
                                <>
                                    <div>
                                        <Label className="text-base">נושא הקרוסלה</Label>
                                        <Textarea
                                            value={topic}
                                            onChange={(e) => setTopic(e.target.value)}
                                            placeholder="לדוגמה: 5 טיפים לחיסכון בהוצאות העסק, היתרונות של התחדשות עירונית..."
                                            rows={3}
                                            className="mt-2"
                                        />
                                    </div>

                                    {/* Style */}
                                    <div>
                                        <Label className="text-base">סגנון תוכן</Label>
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            {STYLES.map((s) => (
                                                <button
                                                    key={s.value}
                                                    onClick={() => setStyle(s.value)}
                                                    className={`p-3 rounded-lg border text-sm flex items-center gap-2 transition-colors ${style === s.value
                                                            ? "border-purple-500 bg-purple-50 text-purple-700"
                                                            : "border-gray-200 hover:border-gray-300"
                                                        }`}
                                                >
                                                    <span>{s.icon}</span>
                                                    <span>{s.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Slide Count */}
                                    <div>
                                        <Label className="text-base">מספר שקופיות</Label>
                                        <div className="flex gap-2 mt-2">
                                            {SLIDE_COUNTS.map((count) => (
                                                <button
                                                    key={count}
                                                    onClick={() => setSlideCount(count)}
                                                    className={`w-10 h-10 rounded-lg border text-sm font-medium transition-colors ${slideCount === count
                                                            ? "border-purple-500 bg-purple-50 text-purple-700"
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
                                        <Label className="text-base">שקופיות ({customSlides.length})</Label>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={addSlide}
                                        >
                                            <Plus className="w-4 h-4 ml-1" />
                                            הוסף שקופית
                                        </Button>
                                    </div>
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                        {customSlides.map((slide, index) => (
                                            <div
                                                key={index}
                                                className="flex items-start gap-2 bg-gray-50 rounded-lg p-2"
                                            >
                                                <span className="w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 mt-1">
                                                    {index + 1}
                                                </span>
                                                {editingIndex === index ? (
                                                    <>
                                                        <Textarea
                                                            value={editText}
                                                            onChange={(e) => setEditText(e.target.value)}
                                                            rows={2}
                                                            className="flex-1 text-sm"
                                                            autoFocus
                                                        />
                                                        <div className="flex flex-col gap-1">
                                                            <button
                                                                onClick={() => saveSlide(index)}
                                                                className="p-1.5 bg-green-100 text-green-600 rounded hover:bg-green-200"
                                                            >
                                                                <Check className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setEditingIndex(null);
                                                                    if (!slide) removeSlide(index);
                                                                }}
                                                                className="p-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="flex-1 text-sm py-1">{slide || "שקופית ריקה"}</p>
                                                        <div className="flex gap-1">
                                                            <button
                                                                onClick={() => {
                                                                    setEditingIndex(index);
                                                                    setEditText(slide);
                                                                }}
                                                                className="p-1.5 text-gray-400 hover:text-gray-600"
                                                            >
                                                                <Edit3 className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => removeSlide(index)}
                                                                className="p-1.5 text-gray-400 hover:text-red-500"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                        {customSlides.length === 0 && (
                                            <div className="text-center py-8 text-gray-400">
                                                <p>לחץ על "הוסף שקופית" כדי להתחיל</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Template Selection */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <Label className="text-base">תבנית עיצוב</Label>
                                    <div className="flex gap-1">
                                        {CATEGORIES.map((cat) => (
                                            <button
                                                key={cat.value}
                                                onClick={() => setCategoryFilter(cat.value)}
                                                className={`px-2 py-1 text-xs rounded transition-colors ${categoryFilter === cat.value
                                                        ? "bg-purple-100 text-purple-700"
                                                        : "text-gray-500 hover:bg-gray-100"
                                                    }`}
                                            >
                                                {cat.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-4 gap-2 max-h-[200px] overflow-y-auto">
                                    {filteredTemplates.map((template) => (
                                        <button
                                            key={template.id}
                                            onClick={() => setSelectedTemplate(template.id)}
                                            className={`relative aspect-[4/5] rounded-lg overflow-hidden border-2 transition-all ${selectedTemplate === template.id
                                                    ? "border-purple-500 ring-2 ring-purple-200"
                                                    : "border-transparent hover:border-gray-300"
                                                }`}
                                        >
                                            <img
                                                src={`/carousel-templates/${template.file}`}
                                                alt={template.style}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = "/placeholder-template.jpg";
                                                }}
                                            />
                                            {selectedTemplate === template.id && (
                                                <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
                                                    <Check className="w-6 h-6 text-white drop-shadow-lg" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    {CAROUSEL_TEMPLATES[selectedTemplate]?.style}
                                </p>
                            </div>

                            {/* Brand Toggle */}
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={useBrand}
                                    onChange={(e) => setUseBrand(e.target.checked)}
                                    className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                />
                                <span className="text-sm">הוסף לוגו ומיתוג</span>
                            </label>

                            {/* Generate Button */}
                            <Button
                                onClick={handleGenerate}
                                disabled={loading || (!isCustomMode && !topic.trim()) || (isCustomMode && customSlides.length < 2)}
                                className="w-full"
                                size="lg"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin ml-2" />
                                        יוצר קרוסלה...
                                    </>
                                ) : (
                                    <>
                                        <Wand2 className="h-5 w-5 ml-2" />
                                        צור קרוסלה
                                    </>
                                )}
                            </Button>

                            <p className="text-sm text-pink-600 text-center">
                                עלות: {isCustomMode ? customSlides.length : slideCount} קרדיטים קרוסלה
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Result Column */}
                <div>
                    <Card className="h-full">
                        <CardContent className="p-6 h-full flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-medium">תצוגה מקדימה</h3>
                                {results.length > 0 && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleDownloadAll}
                                    >
                                        <Download className="w-4 h-4 ml-1" />
                                        הורד הכל
                                    </Button>
                                )}
                            </div>

                            {loading && (
                                <div className="flex-1 bg-gray-100 rounded-lg flex items-center justify-center min-h-[500px]">
                                    <div className="text-center">
                                        <Loader2 className="h-12 w-12 animate-spin text-pink-500 mx-auto mb-4" />
                                        <p className="text-gray-600">יוצר את הקרוסלה שלך...</p>
                                        <p className="text-sm text-gray-400 mt-1">
                                            זה יכול לקחת עד דקה
                                        </p>
                                    </div>
                                </div>
                            )}

                            {results.length > 0 && !loading && (
                                <div className="space-y-4">
                                    {/* Main Preview */}
                                    <div className="relative">
                                        <img
                                            src={results[currentSlide]}
                                            alt={`Slide ${currentSlide + 1}`}
                                            className="w-full rounded-lg border"
                                        />

                                        {/* Navigation Arrows */}
                                        {results.length > 1 && (
                                            <>
                                                <button
                                                    onClick={() => setCurrentSlide((prev) => (prev + 1) % results.length)}
                                                    disabled={currentSlide === results.length - 1}
                                                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white/90 rounded-full shadow-lg hover:bg-white disabled:opacity-50"
                                                >
                                                    <ChevronLeft className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => setCurrentSlide((prev) => (prev - 1 + results.length) % results.length)}
                                                    disabled={currentSlide === 0}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/90 rounded-full shadow-lg hover:bg-white disabled:opacity-50"
                                                >
                                                    <ChevronRight className="w-5 h-5" />
                                                </button>
                                            </>
                                        )}

                                        {/* Slide Counter */}
                                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded-full text-sm">
                                            {currentSlide + 1} / {results.length}
                                        </div>
                                    </div>

                                    {/* Thumbnails */}
                                    <div className="flex gap-2 overflow-x-auto pb-2">
                                        {results.map((url, index) => (
                                            <button
                                                key={index}
                                                onClick={() => setCurrentSlide(index)}
                                                className={`flex-shrink-0 w-16 h-20 rounded-lg overflow-hidden border-2 transition-all ${currentSlide === index
                                                        ? "border-purple-500"
                                                        : "border-transparent opacity-60 hover:opacity-100"
                                                    }`}
                                            >
                                                <img
                                                    src={url}
                                                    alt={`Thumbnail ${index + 1}`}
                                                    className="w-full h-full object-cover"
                                                />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {!loading && results.length === 0 && (
                                <div className="flex-1 bg-gray-50 rounded-lg flex items-center justify-center border-2 border-dashed min-h-[500px]">
                                    <div className="text-center text-gray-400">
                                        <LayoutGrid className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                        <p>הקרוסלה תופיע כאן</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}