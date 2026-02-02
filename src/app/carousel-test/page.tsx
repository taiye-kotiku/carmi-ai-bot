"use client";

import { useState, useRef } from "react";
import Link from "next/link";
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
    MessageSquare,
    Send,
    Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CAROUSEL_TEMPLATES, getTemplatesByCategory } from "@/lib/carousel/templates";

const LOGO_POSITIONS = [
    { value: "top-left", label: "פינה עליונה שמאל" },
    { value: "top-middle", label: "מרכז עליון" },
    { value: "top-right", label: "פינה עליונה ימין" },
    { value: "bottom-left", label: "פינה תחתונה שמאל" },
    { value: "bottom-middle", label: "מרכז תחתון" },
    { value: "bottom-right", label: "פינה תחתונה ימין" },
];

const STYLES = [
    { value: "educational", label: "חינוכי", icon: "📚" },
    { value: "promotional", label: "שיווקי", icon: "📣" },
    { value: "tips", label: "טיפים", icon: "💡" },
];

const CATEGORIES = [
    { value: "all", label: "הכל" },
    { value: "abstract", label: "בניינים" },
    { value: "gradient", label: "גרדיאנט" },
];

const SLIDE_COUNTS = [3, 4, 5, 6];

export default function CarouselTestPage() {
    const [topic, setTopic] = useState("ליווי משפטי בהתחדשות עירונית");
    const [customSlides, setCustomSlides] = useState<string[]>([]);
    const [contentMode, setContentMode] = useState<"ai" | "custom" | "chat">("ai");
    const [selectedTemplate, setSelectedTemplate] = useState("b1");
    const [slideCount, setSlideCount] = useState(5);
    const [style, setStyle] = useState("educational");
    const [logoBase64, setLogoBase64] = useState<string | null>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const [logoPosition, setLogoPosition] = useState("top-right");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<string[]>([]);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editText, setEditText] = useState("");
    const [chatMessage, setChatMessage] = useState("");
    const [chatLoading, setChatLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [templateDesc, setTemplateDesc] = useState("");
    const [templateSuggestLoading, setTemplateSuggestLoading] = useState(false);

    const filteredTemplates = getTemplatesByCategory(categoryFilter);

    function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !file.type.startsWith("image/")) return;
        const reader = new FileReader();
        reader.onload = () => {
            const data = reader.result as string;
            setLogoBase64(data);
            toast.success("הלוגו הועלה");
        };
        reader.readAsDataURL(file);
    }

    async function handleSuggestTemplate() {
        const desc = templateDesc.trim() || topic;
        if (!desc) {
            toast.error("הזן תיאור לבחירת תבנית");
            return;
        }
        setTemplateSuggestLoading(true);
        try {
            const res = await fetch("/api/generate/template-suggest", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ topic: desc, content: desc }),
            });
            const data = await res.json();
            if (data.template_id) {
                setSelectedTemplate(data.template_id);
                toast.success(`נבחרה תבנית: ${CAROUSEL_TEMPLATES[data.template_id]?.style || data.template_id}`);
            }
        } catch {
            toast.error("שגיאה בבחירת תבנית");
        } finally {
            setTemplateSuggestLoading(false);
        }
    }

    const loadExampleSlides = () => {
        setCustomSlides([
            "התחדשות עירונית היא *הזדמנות* לשדרג את איכות החיים",
            "התהליך דורש ליווי *משפטי מקצועי* שיגן על הזכויות שלכם",
            "אנו דואגים להסכמים *ברורים ומאוזנים* מול היזם",
            "ביטחון מלא, שקיפות וזמינות לאורך כל חיי הפרויקט",
            "צרו קשר ל*שיחת ייעוץ* ראשונית ללא התחייבות",
        ]);
        setContentMode("custom");
        setError(null);
    };

    async function handleChatGenerate() {
        if (!chatMessage.trim()) return;
        setChatLoading(true);
        try {
            const res = await fetch("/api/generate/carousel-chat-test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: chatMessage, slideCount, previousSlides: customSlides }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setCustomSlides(data.slides);
            setContentMode("custom");
            setChatMessage("");
            toast.success("התוכן נוצר!");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "שגיאה");
        } finally {
            setChatLoading(false);
        }
    }

    async function handleGenerate() {
        const slides = contentMode === "custom" ? customSlides : null;
        const useTopic = contentMode === "ai" && topic.trim();
        if (!useTopic && (!slides || slides.length < 2)) {
            setError("נא להזין נושא או לפחות 2 שקופיות. ניתן ללחוץ על 'טען דוגמה' לבדיקה מהירה.");
            return;
        }
        setLoading(true);
        setResults([]);
        setError(null);
        try {
            const res = await fetch("/api/generate/carousel-test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    topic: useTopic ? topic : undefined,
                    slides: slides || undefined,
                    template_id: selectedTemplate,
                    slide_count: slides ? slides.length : slideCount,
                    style,
                    logo_base64: logoBase64 || undefined,
                    logo_position: logoPosition,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                const errMsg = data.error || `שגיאה ${res.status}`;
                setError(errMsg);
                toast.error(errMsg);
                return;
            }
            if (!data.images?.length) {
                setError("השרת החזיר תשובה ריקה");
                return;
            }
            setResults(data.images);
            toast.success("הקרוסלה נוצרה!");
        } catch (err) {
            const msg = err instanceof Error ? err.message : "שגיאה בביצוע הבקשה";
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    }

    function addSlide() {
        setCustomSlides([...customSlides, ""]);
        setEditingIndex(customSlides.length);
        setEditText("");
    }
    function saveSlide(i: number) {
        if (!editText.trim()) { removeSlide(i); return; }
        const next = [...customSlides];
        next[i] = editText;
        setCustomSlides(next);
        setEditingIndex(null);
    }
    function removeSlide(i: number) {
        setCustomSlides(customSlides.filter((_, idx) => idx !== i));
        setEditingIndex(null);
    }

    const canGenerate =
        (contentMode === "ai" && topic.trim()) ||
        (contentMode === "custom" && customSlides.length >= 2) ||
        (contentMode === "chat" && customSlides.length >= 2);

    return (
        <div className="min-h-screen bg-gray-100 p-4" dir="rtl">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold">בדיקת קרוסלה (ללא התחברות)</h1>
                        <p className="text-gray-600 text-sm">מצב בדיקה – Supabase לא נדרש</p>
                    </div>
                    <Link href="/" className="text-indigo-600 hover:underline">← חזרה לדף הבית</Link>
                </div>

                <div className="grid lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <Card>
                            <CardContent className="p-6 space-y-4">
                                <Button type="button" variant="outline" size="sm" onClick={loadExampleSlides} className="mb-2">
                                    טען דוגמה (ללא Gemini)
                                </Button>
                                <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                                    <button onClick={() => { setContentMode("ai"); setError(null); }} className={`flex-1 py-2 rounded-md text-sm ${contentMode === "ai" ? "bg-white shadow" : ""}`}>יצירה עם AI</button>
                                    <button onClick={() => { setContentMode("chat"); setError(null); }} className={`flex-1 py-2 rounded-md text-sm ${contentMode === "chat" ? "bg-white shadow" : ""}`}>סוכן תוכן</button>
                                    <button onClick={() => { setContentMode("custom"); setError(null); }} className={`flex-1 py-2 rounded-md text-sm ${contentMode === "custom" ? "bg-white shadow" : ""}`}>כתיבה ידנית</button>
                                </div>
                                {error && (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                        {error}
                                    </div>
                                )}

                                {contentMode === "ai" && (
                                    <>
                                        <div>
                                            <Label>נושא</Label>
                                            <Textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={2} className="mt-1" />
                                        </div>
                                        <div>
                                            <Label>סגנון</Label>
                                            <div className="flex gap-2 mt-1">
                                                {STYLES.map((s) => (
                                                    <button key={s.value} onClick={() => setStyle(s.value)} className={`px-3 py-1 rounded border text-sm ${style === s.value ? "border-indigo-500 bg-indigo-50" : ""}`}>{s.label}</button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <Label>מספר שקופיות</Label>
                                            <div className="flex gap-1 mt-1">
                                                {SLIDE_COUNTS.map((c) => (
                                                    <button key={c} onClick={() => setSlideCount(c)} className={`w-8 h-8 rounded border text-sm ${slideCount === c ? "border-indigo-500 bg-indigo-50" : ""}`}>{c}</button>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}

                                {contentMode === "chat" && (
                                    <div>
                                        <Label>תאר את התוכן בעברית</Label>
                                        <div className="flex gap-2 mt-1">
                                            <Textarea value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} placeholder="למשל: 5 טיפים להתחדשות עירונית" rows={2} className="flex-1" />
                                            <Button onClick={handleChatGenerate} disabled={chatLoading || !chatMessage.trim()}>
                                                {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                        <div className="mt-2">
                                            <Label>מספר שקופיות</Label>
                                            <div className="flex gap-1 mt-1">
                                                {SLIDE_COUNTS.map((c) => (
                                                    <button key={c} onClick={() => setSlideCount(c)} className={`w-8 h-8 rounded border text-xs ${slideCount === c ? "border-indigo-500" : ""}`}>{c}</button>
                                                ))}
                                            </div>
                                        </div>
                                        {customSlides.length > 0 && <p className="text-sm text-green-600 mt-2">נוצרו {customSlides.length} שקופיות</p>}
                                    </div>
                                )}

                                {(contentMode === "custom" || (contentMode === "chat" && customSlides.length > 0)) && (
                                    <div>
                                        <div className="flex justify-between mb-1">
                                            <Label>שקופיות ({customSlides.length})</Label>
                                            <Button size="sm" variant="outline" onClick={addSlide}>+ הוסף</Button>
                                        </div>
                                        <div className="space-y-1 max-h-48 overflow-y-auto">
                                            {customSlides.map((s, i) => (
                                                <div key={i} className="flex gap-2 bg-gray-50 rounded p-2 text-sm">
                                                    <span className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-xs">{i + 1}</span>
                                                    {editingIndex === i ? (
                                                        <>
                                                            <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={1} className="flex-1 text-sm" autoFocus />
                                                            <button onClick={() => saveSlide(i)} className="text-green-600"><Check className="h-4 w-4" /></button>
                                                            <button onClick={() => { setEditingIndex(null); if (!s) removeSlide(i); }} className="text-gray-500"><X className="h-4 w-4" /></button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="flex-1 truncate">{s || "ריק"}</span>
                                                            <button onClick={() => { setEditingIndex(i); setEditText(s); }}><Edit3 className="h-4 w-4 text-gray-400" /></button>
                                                            <button onClick={() => removeSlide(i)}><Trash2 className="h-4 w-4 text-red-400" /></button>
                                                        </>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <Label>תבנית</Label>
                                    <div className="flex gap-2 mt-1 mb-2">
                                        <input
                                            type="text"
                                            placeholder="תאר את העיצוב הרצוי (למשל: בניין, טכנולוגי)"
                                            className="flex-1 px-3 py-2 border rounded text-sm"
                                            value={templateDesc}
                                            onChange={(e) => setTemplateDesc(e.target.value)}
                                        />
                                        <Button type="button" variant="outline" size="sm" onClick={handleSuggestTemplate} disabled={templateSuggestLoading}>
                                            {templateSuggestLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                            בחר עם Gemini
                                        </Button>
                                    </div>
                                    <div className="flex gap-1">
                                        {CATEGORIES.map((c) => (
                                            <button key={c.value} onClick={() => setCategoryFilter(c.value)} className={`px-2 py-1 text-xs rounded ${categoryFilter === c.value ? "bg-indigo-100" : ""}`}>{c.label}</button>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-4 gap-2 mt-2 max-h-32 overflow-y-auto">
                                        {filteredTemplates.map((t) => (
                                            <button key={t.id} onClick={() => setSelectedTemplate(t.id)} className={`aspect-[4/5] rounded overflow-hidden border-2 ${selectedTemplate === t.id ? "border-indigo-500" : ""}`}>
                                                <img src={`/carousel-templates/${t.file}`} alt="" className="w-full h-full object-cover" />
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <Label>לוגו</Label>
                                    <div className="mt-2 flex items-center gap-3">
                                        <div
                                            onClick={() => logoInputRef.current?.click()}
                                            className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors"
                                        >
                                            {logoBase64 ? (
                                                <img src={logoBase64} alt="לוגו" className="w-full h-full object-contain rounded" />
                                            ) : (
                                                <>
                                                    <Upload className="h-6 w-6 text-gray-400" />
                                                    <span className="text-xs text-gray-500">העלה לוגו</span>
                                                </>
                                            )}
                                        </div>
                                        <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
                                        {logoBase64 && <button onClick={() => setLogoBase64(null)} className="text-sm text-red-500">הסר</button>}
                                    </div>
                                    <Label className="mt-2 block">מיקום לוגו</Label>
                                    <div className="grid grid-cols-3 gap-1 mt-1">
                                        {LOGO_POSITIONS.map((p) => (
                                            <button key={p.value} onClick={() => setLogoPosition(p.value)} className={`p-1 rounded border text-xs ${logoPosition === p.value ? "border-indigo-500 bg-indigo-50" : ""}`}>{p.label}</button>
                                        ))}
                                    </div>
                                </div>

                                <Button onClick={handleGenerate} disabled={loading || !canGenerate} className="w-full" size="lg">
                                    {loading ? <><Loader2 className="h-4 w-4 animate-spin ml-2" />יוצר...</> : <><Wand2 className="h-4 w-4 ml-2" />צור קרוסלה</>}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardContent className="p-6">
                            <div className="flex justify-between mb-4">
                                <h3 className="font-medium">תצוגה מקדימה</h3>
                                {results.length > 0 && (
                                    <Button size="sm" variant="outline" onClick={() => results.forEach((url, i) => { const a = document.createElement("a"); a.href = url; a.download = `slide-${i + 1}.png`; a.click(); })}>
                                        <Download className="h-4 w-4 ml-1" />הורד
                                    </Button>
                                )}
                            </div>
                            {loading && <div className="h-96 flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-indigo-500" /></div>}
                            {results.length > 0 && !loading && (
                                <div>
                                    <img src={results[currentSlide]} alt="" className="w-full rounded-lg border" />
                                    {results.length > 1 && (
                                        <>
                                            <div className="flex justify-center gap-2 mt-2">
                                                <button onClick={() => setCurrentSlide((p) => (p - 1 + results.length) % results.length)} className="p-2 bg-white rounded-full shadow"><ChevronRight className="h-5 w-5" /></button>
                                                <span className="py-2">{currentSlide + 1} / {results.length}</span>
                                                <button onClick={() => setCurrentSlide((p) => (p + 1) % results.length)} className="p-2 bg-white rounded-full shadow"><ChevronLeft className="h-5 w-5" /></button>
                                            </div>
                                            <div className="flex gap-1 mt-2 overflow-x-auto">
                                                {results.map((url, i) => (
                                                    <button key={i} onClick={() => setCurrentSlide(i)} className={`flex-shrink-0 w-14 h-16 rounded overflow-hidden border-2 ${currentSlide === i ? "border-indigo-500" : ""}`}>
                                                        <img src={url} alt="" className="w-full h-full object-cover" />
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                            {!loading && results.length === 0 && <div className="h-96 flex items-center justify-center text-gray-400 border-2 border-dashed rounded-lg"><LayoutGrid className="h-12 w-12 opacity-50" /></div>}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
