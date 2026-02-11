"use client";

import { useState, useRef, useEffect } from "react";
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
    Upload,
    MessageSquare,
    Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CAROUSEL_TEMPLATES } from "@/lib/carousel/templates";
import type { CarouselTemplate } from "@/lib/carousel/templates";
import { requestNotificationPermission, notifyGenerationComplete } from "@/lib/services/notifications";
import { ExportFormats } from "@/components/export-formats";
import { CREDIT_COSTS } from "@/lib/config/credits";

const LOGO_POSITIONS = [
    { value: "top-right", label: "פינה עליונה ימין", grid: "col-start-3 row-start-1" },
    { value: "top-middle", label: "מרכז עליון", grid: "col-start-2 row-start-1" },
    { value: "top-left", label: "פינה עליונה שמאל", grid: "col-start-1 row-start-1" },
    { value: "bottom-right", label: "פינה תחתונה ימין", grid: "col-start-3 row-start-2" },
    { value: "bottom-middle", label: "מרכז תחתון", grid: "col-start-2 row-start-2" },
    { value: "bottom-left", label: "פינה תחתונה שמאל", grid: "col-start-1 row-start-2" },
] as const;

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
    { value: "abstract", label: "בניינים" },
    { value: "nature", label: "טבע" },
];

const SLIDE_COUNTS = [3, 4, 5, 6, 7, 8];

const FONT_FAMILIES = [
    { value: "Assistant-Bold", label: "הדגשה חזקה מאוד (כותרות גדולות)", file: "Assistant-Bold.ttf" },
    { value: "Assistant-ExtraBold", label: "הדגשה חזקה (כותרות)", file: "Assistant-ExtraBold.ttf" },
    { value: "Assistant-SemiBold", label: "הדגשה בינונית", file: "Assistant-SemiBold.ttf" },
    { value: "Assistant-Medium", label: "הדגשה רגילה", file: "Assistant-Medium.ttf" },
    { value: "Assistant-Regular", label: "טקסט ארוך (פסקאות)", file: "Assistant-Regular.ttf" },
    { value: "Assistant-Light", label: "טקסט משני (הערות)", file: "Assistant-Light.ttf" },
    { value: "Assistant-ExtraLight", label: "עיצוב עדין (עיטורים)", file: "Assistant-ExtraLight.ttf" },
    { value: "Antiochus-Bold", label: "סגנון תנכי (מסורתי, רשמי)", file: "Antiochus-Bold.ttf" },
    { value: "Rubik-Medium-Italic", label: "מודרני נטוי (הייטק)", file: "Rubik-Medium-Italic.ttf" },
    { value: "GveretLevin-AlefAlefAlef-Regular", label: "כתב יד ישראלי (אנושי)", file: "GveretLevin-AlefAlefAlef-Regular.ttf" },
];

export default function CarouselGenerationPage() {
    const [topic, setTopic] = useState("");
    const [customSlides, setCustomSlides] = useState<string[]>([]);
    const [contentMode, setContentMode] = useState<"ai" | "custom" | "chat">("ai");
    const [selectedTemplate, setSelectedTemplate] = useState("b1");
    const [slideCount, setSlideCount] = useState(5);
    const [style, setStyle] = useState("educational");
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [logoBase64, setLogoBase64] = useState<string | null>(null);
    const [logoPosition, setLogoPosition] = useState<string>("top-right");
    const [logoSize, setLogoSize] = useState<"small" | "medium" | "large">("medium");
    const [logoTransparent, setLogoTransparent] = useState(false);
    const [categoryFilter, setCategoryFilter] = useState("all");
    
    // Background image upload
    const [backgroundImage, setBackgroundImage] = useState<File | null>(null);
    const [backgroundImagePreview, setBackgroundImagePreview] = useState<string | null>(null);
    const [backgroundImageBase64, setBackgroundImageBase64] = useState<string | null>(null);
    const [useCustomBackground, setUseCustomBackground] = useState(false);
    const backgroundInputRef = useRef<HTMLInputElement>(null);
    
    // Font customization states
    const [fontFamily, setFontFamily] = useState("Assistant-Bold");
    const [headlineFontSize, setHeadlineFontSize] = useState(95);
    const [bodyFontSize, setBodyFontSize] = useState(70);
    const [fontColor, setFontColor] = useState("#FFFFFF");
    const [showFontSettings, setShowFontSettings] = useState(false);

    const [loading, setLoading] = useState(false);
    const [logoUploading, setLogoUploading] = useState(false);
    const [results, setResults] = useState<string[]>([]);
    const [currentSlide, setCurrentSlide] = useState(0);

    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editText, setEditText] = useState("");

    const [chatMessage, setChatMessage] = useState("");
    const [chatLoading, setChatLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [templateDesc, setTemplateDesc] = useState("");
    const [templateSuggestLoading, setTemplateSuggestLoading] = useState(false);
    const [allTemplates, setAllTemplates] = useState<CarouselTemplate[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load all templates from API on mount
    useEffect(() => {
        async function loadTemplates() {
            try {
                const res = await fetch("/api/templates?t=" + Date.now(), {
                    cache: "no-store", // Force no cache
                });
                if (!res.ok) {
                    throw new Error(`Failed to fetch templates: ${res.status}`);
                }
                const data = await res.json();
                console.log("Templates API response:", data);
                console.log("Templates count:", data.templates?.length || 0);
                console.log("Registered:", data.registered);
                console.log("Auto-registered:", data.autoRegistered);
                
                if (data.templates && Array.isArray(data.templates) && data.templates.length > 0) {
                    console.log("Setting templates:", data.templates.length);
                    setAllTemplates(data.templates);
                } else {
                    console.warn("Invalid templates data, using fallback:", data);
                    // Fallback to registered templates
                    setAllTemplates(Object.values(CAROUSEL_TEMPLATES));
                }
            } catch (err) {
                console.error("Failed to load templates:", err);
                // Fallback to registered templates on error
                setAllTemplates(Object.values(CAROUSEL_TEMPLATES));
            } finally {
                setTemplatesLoading(false);
            }
        }
        loadTemplates();
    }, []);

    const filteredTemplates = categoryFilter === "all" 
        ? allTemplates 
        : allTemplates.filter((t) => t.category === categoryFilter);
    
    // Handle background image upload
    async function handleBackgroundUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            toast.error("נא להעלות קובץ תמונה (PNG, JPG)");
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            toast.error("גודל מקסימלי 10MB");
            return;
        }
        setBackgroundImage(file);
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result as string;
            setBackgroundImagePreview(base64);
            setBackgroundImageBase64(base64);
            setUseCustomBackground(true);
        };
        reader.readAsDataURL(file);
        e.target.value = "";
    }

    const hasLogo = !!logoUrl || !!logoBase64;

    async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            toast.error("נא להעלות קובץ תמונה (PNG, JPG)");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error("גודל מקסימלי 5MB");
            return;
        }
        setLogoUploading(true);
        setError(null);
        try {
            const formData = new FormData();
            formData.append("logo", file);
            const res = await fetch("/api/upload/logo", {
                method: "POST",
                body: formData,
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "שגיאה בהעלאה");
            }
            const { url } = await res.json();
            setLogoUrl(url);
            setLogoBase64(null);
            toast.success("הלוגו הועלה בהצלחה");
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "שגיאה בהעלאת הלוגו";
            toast.error(msg);
            const reader = new FileReader();
            reader.onload = () => {
                setLogoBase64(reader.result as string);
                setLogoUrl(null);
                toast.success("הלוגו מוכן לשימוש (העלאה ישירה)");
            };
            reader.readAsDataURL(file);
        } finally {
            setLogoUploading(false);
        }
        e.target.value = "";
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

    function loadExampleSlides() {
        setCustomSlides([
            "התחדשות עירונית היא *הזדמנות* לשדרג את איכות החיים",
            "התהליך דורש ליווי *משפטי מקצועי* שיגן על הזכויות שלכם",
            "אנו דואגים להסכמים *ברורים ומאוזנים* מול היזם",
            "ביטחון מלא, שקיפות וזמינות לאורך כל חיי הפרויקט",
            "צרו קשר ל*שיחת ייעוץ* ראשונית ללא התחייבות",
        ]);
        setContentMode("custom");
        setError(null);
        toast.success("נטענה דוגמה");
    }

    async function handleChatGenerate() {
        if (!chatMessage.trim()) {
            toast.error("נא להזין תוכן");
            return;
        }
        setChatLoading(true);
        try {
            const res = await fetch("/api/generate/carousel-chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: chatMessage,
                    slideCount,
                    previousSlides: customSlides.length ? customSlides : undefined,
                }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "שגיאה");
            }
            const { slides } = await res.json();
            setCustomSlides(slides);
            setContentMode("custom");
            setChatMessage("");
            toast.success("התוכן נוצר! ניתן לערוך לפני יצירת הקרוסלה");
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "שגיאה ביצירת תוכן");
        } finally {
            setChatLoading(false);
        }
    }

    async function handleGenerate() {
        const slides = contentMode === "custom" ? customSlides : null;
        const useTopic = contentMode === "ai" && topic.trim();

        if (!useTopic && (!slides || slides.length < 2)) {
            setError("נא להזין נושא או לפחות 2 שקופיות. ניתן ללחוץ על 'טען דוגמה' לבדיקה.");
            toast.error("נא להזין נושא או לפחות 2 שקופיות");
            return;
        }

        setLoading(true);
        setResults([]);
        setCurrentSlide(0);
        setError(null);

        try {
            const response = await fetch("/api/generate/carousel", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    topic: useTopic ? topic : undefined,
                    slides: slides || undefined,
                    template_id: useCustomBackground && backgroundImageBase64 ? "custom" : selectedTemplate,
                    slide_count: slides ? slides.length : slideCount,
                    style,
                    use_brand: false,
                    logo_url: logoUrl || undefined,
                    logo_base64: logoBase64 || undefined,
                    logo_position: logoPosition,
                    logo_size: logoSize,
                    logo_transparent: logoTransparent,
                    font_family: fontFamily,
                    headline_font_size: headlineFontSize,
                    body_font_size: bodyFontSize,
                    font_color: fontColor,
                    custom_background_base64: useCustomBackground ? backgroundImageBase64 : undefined,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                const errMsg = data.error || "שגיאה";
                setError(errMsg);
                throw new Error(errMsg);
            }

            const { jobId } = await response.json();
            let attempts = 0;
            while (attempts < 60) {
                await new Promise((r) => setTimeout(r, 2000));
                const statusRes = await fetch(`/api/jobs/${jobId}`);
                const status = await statusRes.json();

                if (status.status === "completed") {
                    setResults(status.result.images);
                    toast.success("הקרוסלה נוצרה בהצלחה! 🎨");
                    // Request permission and show notification
                    requestNotificationPermission().then(() => {
                        notifyGenerationComplete("carousel", status.result.images?.length);
                    });
                    break;
                }
                if (status.status === "failed") {
                    setError(status.error || "הקרוסלה נכשלה");
                    throw new Error(status.error);
                }
                attempts++;
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "שגיאה";
            setError(msg);
            toast.error(msg);
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

    const canGenerate =
        (contentMode === "ai" && topic.trim()) ||
        (contentMode === "custom" && customSlides.length >= 2) ||
        (contentMode === "chat" && customSlides.length >= 2);

    return (
        <div className="max-w-6xl mx-auto" dir="rtl">
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="h-12 w-12 bg-pink-100 rounded-xl flex items-center justify-center">
                        <LayoutGrid className="h-6 w-6 text-pink-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">יצירת קרוסלה</h1>
                        <p className="text-gray-600">צור קרוסלה מרהיבה עם הלוגו שלך</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    {/* לוגו */}
                    <Card>
                        <CardContent className="p-6">
                            <Label className="text-base font-medium">העלאת לוגו</Label>
                            <div className="mt-3 flex items-center gap-4">
                                <div
                                    onClick={() => !logoUploading && fileInputRef.current?.click()}
                                    className={`w-24 h-24 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-colors ${
                                        logoUploading ? "border-gray-200 bg-gray-50 cursor-wait" : "border-gray-300 cursor-pointer hover:border-pink-400 hover:bg-pink-50/50"
                                    }`}
                                >
                                    {logoUploading ? (
                                        <Loader2 className="h-8 w-8 text-pink-500 animate-spin" />
                                    ) : hasLogo ? (
                                        <img
                                            src={logoUrl || logoBase64 || ""}
                                            alt="לוגו"
                                            className="w-full h-full object-contain rounded-xl"
                                        />
                                    ) : (
                                        <>
                                            <Upload className="h-8 w-8 text-gray-400" />
                                            <span className="text-xs text-gray-500 mt-1">לחץ להעלאה</span>
                                        </>
                                    )}
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleLogoUpload}
                                />
                                <div className="flex-1">
                                    <p className="text-sm text-gray-500">PNG או JPG, עד 5MB</p>
                                    {hasLogo && (
                                        <button
                                            onClick={() => { setLogoUrl(null); setLogoBase64(null); setLogoTransparent(false); }}
                                            className="text-sm text-red-500 hover:underline mt-1"
                                        >
                                            הסר לוגו
                                        </button>
                                    )}
                                </div>
                            </div>

                            {hasLogo && (
                                <>
                                    <div className="mt-4">
                                        <Label className="text-base font-medium">מיקום הלוגו</Label>
                                        <div className="grid grid-cols-3 gap-2 mt-2">
                                            {LOGO_POSITIONS.map((pos) => (
                                                <button
                                                    key={pos.value}
                                                    onClick={() => setLogoPosition(pos.value)}
                                                    className={`p-2 rounded-lg border text-xs text-center transition-colors ${
                                                        logoPosition === pos.value
                                                            ? "border-pink-500 bg-pink-50 text-pink-700"
                                                            : "border-gray-200 hover:border-gray-300"
                                                    }`}
                                                >
                                                    {pos.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="mt-4">
                                        <Label className="text-base font-medium">גודל הלוגו</Label>
                                        <div className="grid grid-cols-3 gap-2 mt-2">
                                            <button
                                                onClick={() => setLogoSize("small")}
                                                className={`p-2 rounded-lg border text-xs text-center transition-colors ${
                                                    logoSize === "small"
                                                        ? "border-pink-500 bg-pink-50 text-pink-700"
                                                        : "border-gray-200 hover:border-gray-300"
                                                }`}
                                            >
                                                קטן
                                            </button>
                                            <button
                                                onClick={() => setLogoSize("medium")}
                                                className={`p-2 rounded-lg border text-xs text-center transition-colors ${
                                                    logoSize === "medium"
                                                        ? "border-pink-500 bg-pink-50 text-pink-700"
                                                        : "border-gray-200 hover:border-gray-300"
                                                }`}
                                            >
                                                בינוני
                                            </button>
                                            <button
                                                onClick={() => setLogoSize("large")}
                                                className={`p-2 rounded-lg border text-xs text-center transition-colors ${
                                                    logoSize === "large"
                                                        ? "border-pink-500 bg-pink-50 text-pink-700"
                                                        : "border-gray-200 hover:border-gray-300"
                                                }`}
                                            >
                                                גדול
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mt-4">
                                        <button
                                            onClick={() => setLogoTransparent(!logoTransparent)}
                                            className={`w-full p-3 rounded-lg border text-sm text-center transition-colors ${
                                                logoTransparent
                                                    ? "border-pink-500 bg-pink-50 text-pink-700"
                                                    : "border-gray-200 hover:border-gray-300 bg-white"
                                            }`}
                                        >
                                            {logoTransparent ? "✓ לוגו שקוף" : "לוגו שקוף"}
                                        </button>
                                        <p className="text-xs text-gray-500 mt-1 text-center">
                                            {logoTransparent 
                                                ? "הלוגו יוצג ללא רקע (שקוף)" 
                                                : "הלוגו יוצג עם רקע לבן למניעת טשטוש"}
                                        </p>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* העלאת רקע מותאם אישית */}
                    <Card>
                        <CardContent className="p-6">
                            <Label className="text-base font-medium mb-3 block">רקע מותאם אישית</Label>
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="useCustomBackground"
                                        checked={useCustomBackground}
                                        onChange={(e) => {
                                            setUseCustomBackground(e.target.checked);
                                            if (!e.target.checked) {
                                                setBackgroundImage(null);
                                                setBackgroundImagePreview(null);
                                                setBackgroundImageBase64(null);
                                            }
                                        }}
                                        className="rounded"
                                    />
                                    <label htmlFor="useCustomBackground" className="text-sm">
                                        השתמש ברקע מותאם אישית במקום תבנית
                                    </label>
                                </div>
                                
                                {useCustomBackground && (
                                    <>
                                        <input
                                            ref={backgroundInputRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleBackgroundUpload}
                                        />
                                        {backgroundImagePreview ? (
                                            <div className="relative">
                                                <img
                                                    src={backgroundImagePreview}
                                                    alt="רקע"
                                                    className="w-full h-48 object-cover rounded-lg border"
                                                />
                                                <button
                                                    onClick={() => {
                                                        setBackgroundImage(null);
                                                        setBackgroundImagePreview(null);
                                                        setBackgroundImageBase64(null);
                                                        if (backgroundInputRef.current) {
                                                            backgroundInputRef.current.value = "";
                                                        }
                                                    }}
                                                    className="absolute top-2 left-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div
                                                onClick={() => backgroundInputRef.current?.click()}
                                                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-pink-400 hover:bg-pink-50/50 transition-colors"
                                            >
                                                <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                                                <p className="text-sm text-gray-600">לחץ להעלאת תמונת רקע</p>
                                                <p className="text-xs text-gray-400 mt-1">PNG או JPG, עד 10MB</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* הגדרות פונט */}
                    <Card>
                        <CardContent className="p-6">
                            <button
                                onClick={() => setShowFontSettings(!showFontSettings)}
                                className="w-full flex items-center justify-between text-base font-medium hover:text-pink-600 transition-colors"
                            >
                                <span>⚙️ הגדרות פונט וטקסט</span>
                                <span className="text-sm text-gray-400">{showFontSettings ? "▼" : "▲"}</span>
                            </button>
                            
                            {showFontSettings && (
                                <div className="mt-4 space-y-4 border-t pt-4">
                                    {/* בחירת פונט */}
                                    <div>
                                        <Label>משפחת פונט</Label>
                                        <select
                                            value={fontFamily}
                                            onChange={(e) => setFontFamily(e.target.value)}
                                            className="w-full mt-2 p-2 border rounded-lg bg-white"
                                        >
                                            {FONT_FAMILIES.map((font) => (
                                                <option key={font.value} value={font.value}>
                                                    {font.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* צבע טקסט */}
                                    <div>
                                        <Label>צבע טקסט</Label>
                                        <div className="flex items-center gap-3 mt-2">
                                            <input
                                                type="color"
                                                value={fontColor}
                                                onChange={(e) => setFontColor(e.target.value)}
                                                className="w-16 h-10 rounded border cursor-pointer"
                                            />
                                            <Input
                                                type="text"
                                                value={fontColor}
                                                onChange={(e) => setFontColor(e.target.value)}
                                                placeholder="#FFFFFF"
                                                className="flex-1"
                                            />
                                        </div>
                                    </div>

                                    {/* גודל כותרת */}
                                    <div>
                                        <Label>גודל כותרת (טקסט מודגש *כותרת*)</Label>
                                        <div className="flex items-center gap-3 mt-2">
                                            <input
                                                type="range"
                                                min="60"
                                                max="140"
                                                step="5"
                                                value={headlineFontSize}
                                                onChange={(e) => setHeadlineFontSize(Number(e.target.value))}
                                                className="flex-1"
                                            />
                                            <span className="w-12 text-center font-medium">{headlineFontSize}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">
                                            טקסט בין כוכביות (*טקסט*) יופיע בגודל זה
                                        </p>
                                    </div>

                                    {/* גודל טקסט רגיל */}
                                    <div>
                                        <Label>גודל טקסט רגיל</Label>
                                        <div className="flex items-center gap-3 mt-2">
                                            <input
                                                type="range"
                                                min="40"
                                                max="100"
                                                step="5"
                                                value={bodyFontSize}
                                                onChange={(e) => setBodyFontSize(Number(e.target.value))}
                                                className="flex-1"
                                            />
                                            <span className="w-12 text-center font-medium">{bodyFontSize}</span>
                                        </div>
                                    </div>

                                    {/* תצוגה מקדימה של הפונט */}
                                    <div>
                                        <Label>תצוגה מקדימה</Label>
                                        <div 
                                            className="bg-gray-900 rounded-lg p-6 text-center border-2 border-gray-700" 
                                            style={{ 
                                                direction: "rtl",
                                                fontFamily: fontFamily === "Assistant-Bold" ? "var(--font-heebo)" : undefined
                                            }}
                                        >
                                            <style>{`
                                                @font-face {
                                                    font-family: 'PreviewFont';
                                                    src: url('/fonts/${fontFamily}.ttf') format('truetype');
                                                }
                                                .font-preview {
                                                    font-family: 'PreviewFont', sans-serif;
                                                }
                                            `}</style>
                                            <p 
                                                className="font-preview"
                                                style={{ 
                                                    color: fontColor, 
                                                    fontSize: `${bodyFontSize / 4}px`,
                                                    lineHeight: 1.5
                                                }}
                                            >
                                                זהו טקסט רגיל בגודל {bodyFontSize}px
                                            </p>
                                            <p 
                                                className="font-preview"
                                                style={{ 
                                                    color: fontColor, 
                                                    fontSize: `${headlineFontSize / 4}px`, 
                                                    fontWeight: "bold", 
                                                    marginTop: "12px",
                                                    lineHeight: 1.5
                                                }}
                                            >
                                                זו כותרת מודגשת בגודל {headlineFontSize}px
                                            </p>
                                            <p 
                                                className="font-preview"
                                                style={{ 
                                                    color: fontColor, 
                                                    fontSize: `${bodyFontSize / 4}px`,
                                                    marginTop: "8px",
                                                    opacity: 0.8
                                                }}
                                            >
                                                דוגמה: *התחדשות עירונית* היא הזדמנות
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* תוכן */}
                    <Card>
                        <CardContent className="p-6 space-y-6">
                            <Button type="button" variant="outline" size="sm" onClick={loadExampleSlides} className="mb-2">
                                טען דוגמה
                            </Button>
                            {error && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                    {error}
                                </div>
                            )}
                            <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                                <button
                                    onClick={() => { setContentMode("ai"); setError(null); }}
                                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                                        contentMode === "ai" ? "bg-white shadow text-purple-700" : "text-gray-600"
                                    }`}
                                >
                                    <Sparkles className="inline-block w-4 h-4 ml-1" />
                                    יצירה עם AI
                                </button>
                                <button
                                    onClick={() => { setContentMode("chat"); setError(null); }}
                                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                                        contentMode === "chat" ? "bg-white shadow text-purple-700" : "text-gray-600"
                                    }`}
                                >
                                    <MessageSquare className="inline-block w-4 h-4 ml-1" />
                                    סוכן תוכן
                                </button>
                                <button
                                    onClick={() => { setContentMode("custom"); setError(null); }}
                                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                                        contentMode === "custom" ? "bg-white shadow text-purple-700" : "text-gray-600"
                                    }`}
                                >
                                    <Edit3 className="inline-block w-4 h-4 ml-1" />
                                    כתיבה ידנית
                                </button>
                            </div>

                            {contentMode === "ai" && (
                                <>
                                    <div>
                                        <Label>נושא הקרוסלה</Label>
                                        <Textarea
                                            value={topic}
                                            onChange={(e) => setTopic(e.target.value)}
                                            placeholder="לדוגמה: 5 טיפים לחיסכון, ליווי משפטי בהתחדשות עירונית..."
                                            rows={3}
                                            className="mt-2"
                                        />
                                    </div>
                                    <div>
                                        <Label>סגנון תוכן</Label>
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            {STYLES.map((s) => (
                                                <button
                                                    key={s.value}
                                                    onClick={() => setStyle(s.value)}
                                                    className={`p-3 rounded-lg border text-sm flex items-center gap-2 ${
                                                        style === s.value ? "border-purple-500 bg-purple-50" : "border-gray-200"
                                                    }`}
                                                >
                                                    <span>{s.icon}</span>
                                                    <span>{s.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <Label>מספר שקופיות</Label>
                                        <div className="flex gap-2 mt-2">
                                            {SLIDE_COUNTS.map((c) => (
                                                <button
                                                    key={c}
                                                    onClick={() => setSlideCount(c)}
                                                    className={`w-10 h-10 rounded-lg border text-sm font-medium ${
                                                        slideCount === c ? "border-purple-500 bg-purple-50" : "border-gray-200"
                                                    }`}
                                                >
                                                    {c}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            {contentMode === "chat" && (
                                <div>
                                    <Label>שוחח עם סוכן התוכן</Label>
                                    <p className="text-sm text-gray-500 mb-2">
                                        תאר את התוכן הרצוי בעברית – הסוכן ייצור את השקופיות עבורך
                                    </p>
                                    <div className="flex gap-2">
                                        <Textarea
                                            value={chatMessage}
                                            onChange={(e) => setChatMessage(e.target.value)}
                                            placeholder="למשל: צור קרוסלה על ליווי משפטי בהתחדשות עירונית, 5 שקופיות"
                                            rows={2}
                                            className="flex-1"
                                        />
                                        <Button
                                            onClick={handleChatGenerate}
                                            disabled={chatLoading || !chatMessage.trim()}
                                        >
                                            {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                    <div className="mt-2">
                                        <Label>מספר שקופיות</Label>
                                        <div className="flex gap-2 mt-1">
                                            {SLIDE_COUNTS.map((c) => (
                                                <button
                                                    key={c}
                                                    onClick={() => setSlideCount(c)}
                                                    className={`w-8 h-8 rounded border text-xs ${
                                                        slideCount === c ? "border-purple-500 bg-purple-50" : "border-gray-200"
                                                    }`}
                                                >
                                                    {c}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {customSlides.length > 0 && (
                                        <p className="text-sm text-green-600 mt-2">
                                            נוצרו {customSlides.length} שקופיות – ניתן לערוך למטה
                                        </p>
                                    )}
                                </div>
                            )}

                            {(contentMode === "custom" || (contentMode === "chat" && customSlides.length > 0)) && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <Label>שקופיות ({customSlides.length})</Label>
                                        <Button size="sm" variant="outline" onClick={addSlide}>
                                            <Plus className="w-4 h-4 ml-1" />
                                            הוסף שקופית
                                        </Button>
                                    </div>
                                    <div className="space-y-2 max-h-[280px] overflow-y-auto">
                                        {customSlides.map((slide, index) => (
                                            <div key={index} className="flex items-start gap-2 bg-gray-50 rounded-lg p-2">
                                                <span className="w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-1">
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
                                                            <button onClick={() => saveSlide(index)} className="p-1.5 bg-green-100 text-green-600 rounded hover:bg-green-200">
                                                                <Check className="w-4 h-4" />
                                                            </button>
                                                            <button onClick={() => { setEditingIndex(null); if (!slide) removeSlide(index); }} className="p-1.5 bg-gray-100 rounded hover:bg-gray-200">
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="flex-1 text-sm py-1">{slide || "שקופית ריקה"}</p>
                                                        <div className="flex gap-1">
                                                            <button onClick={() => { setEditingIndex(index); setEditText(slide); }} className="p-1.5 text-gray-400 hover:text-gray-600">
                                                                <Edit3 className="w-4 h-4" />
                                                            </button>
                                                            <button onClick={() => removeSlide(index)} className="p-1.5 text-gray-400 hover:text-red-500">
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <div className="mb-2">
                                    <Label>תבנית עיצוב</Label>
                                    <div className="flex gap-2 mt-2 mb-2">
                                        <input
                                            type="text"
                                            placeholder="תאר עיצוב (למשל: בניין, טכנולוגי)"
                                            className="flex-1 px-3 py-2 border rounded-lg text-sm"
                                            value={templateDesc}
                                            onChange={(e) => setTemplateDesc(e.target.value)}
                                        />
                                        <Button type="button" variant="outline" size="sm" onClick={handleSuggestTemplate} disabled={templateSuggestLoading}>
                                            {templateSuggestLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                            בחר עם Gemini
                                        </Button>
                                    </div>
                                    <div className="flex gap-1">
                                        {CATEGORIES.map((cat) => (
                                            <button
                                                key={cat.value}
                                                onClick={() => setCategoryFilter(cat.value)}
                                                className={`px-2 py-1 text-xs rounded ${categoryFilter === cat.value ? "bg-purple-100 text-purple-700" : "text-gray-500"}`}
                                            >
                                                {cat.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div className="text-xs text-gray-500 flex items-center justify-between">
                                        <span>
                                            {templatesLoading ? "טוען תבניות..." : `${filteredTemplates.length} תבניות זמינות`}
                                        </span>
                                        {!templatesLoading && allTemplates.length > 0 && (
                                            <button
                                                onClick={async () => {
                                                    setTemplatesLoading(true);
                                                    try {
                                                        const res = await fetch("/api/templates?t=" + Date.now(), { cache: "no-store" });
                                                        const data = await res.json();
                                                        if (data.templates && Array.isArray(data.templates)) {
                                                            setAllTemplates(data.templates);
                                                            toast.success(`נטענו ${data.templates.length} תבניות`);
                                                        }
                                                    } catch (err) {
                                                        toast.error("שגיאה בטעינת תבניות");
                                                    } finally {
                                                        setTemplatesLoading(false);
                                                    }
                                                }}
                                                className="text-xs text-purple-600 hover:text-purple-800 underline"
                                            >
                                                רענן
                                            </button>
                                        )}
                                    </div>
                                    {templatesLoading ? (
                                        <div className="flex items-center justify-center py-8">
                                            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                                        </div>
                                    ) : filteredTemplates.length === 0 ? (
                                        <div className="text-center py-8 text-gray-500">
                                            לא נמצאו תבניות. נסה לרענן.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-4 gap-2 max-h-[500px] overflow-y-auto p-2 border rounded-lg bg-gray-50">
                                            {filteredTemplates.map((template) => (
                                            <button
                                                key={template.id}
                                                onClick={() => setSelectedTemplate(template.id)}
                                                className={`relative aspect-[4/5] rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                                                    selectedTemplate === template.id ? "border-purple-500 ring-2 ring-purple-200 shadow-lg" : "border-gray-300 hover:border-purple-300"
                                                }`}
                                            >
                                                <img
                                                    src={`/carousel-templates/${template.file}`}
                                                    alt={template.style}
                                                    className="w-full h-full object-cover"
                                                    loading="lazy"
                                                />
                                                {selectedTemplate === template.id && (
                                                    <div className="absolute inset-0 bg-purple-500/30 flex items-center justify-center">
                                                        <Check className="w-6 w-6 text-white drop-shadow-lg" />
                                                    </div>
                                                )}
                                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate">
                                                    {template.style}
                                                </div>
                                            </button>
                                        ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <Button
                                onClick={handleGenerate}
                                disabled={loading || !canGenerate}
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
                                עלות: {CREDIT_COSTS.carousel_generation} קרדיטים
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <Card className="h-fit">
                    <CardContent className="p-6">
                        <div className="flex justify-between mb-4">
                            <h3 className="text-lg font-medium">תצוגה מקדימה</h3>
                            {results.length > 0 && (
                                <Button size="sm" variant="outline" onClick={handleDownloadAll}>
                                    <Download className="w-4 h-4 ml-1" />
                                    הורד הכל
                                </Button>
                            )}
                        </div>

                        {loading && (
                            <div className="bg-gray-100 rounded-lg flex items-center justify-center min-h-[500px]">
                                <div className="text-center">
                                    <Loader2 className="h-12 w-12 animate-spin text-pink-500 mx-auto mb-4" />
                                    <p className="text-gray-600">יוצר את הקרוסלה...</p>
                                </div>
                            </div>
                        )}

                        {results.length > 0 && !loading && (
                            <div className="space-y-4">
                                <div className="relative overflow-hidden rounded-lg border bg-gray-900" style={{ aspectRatio: "1080/1350", minHeight: 320 }}>
                                    {results.map((url, i) => (
                                        <div
                                            key={i}
                                            className="absolute inset-0 flex items-center justify-center transition-opacity duration-300"
                                            style={{
                                                opacity: currentSlide === i ? 1 : 0,
                                                pointerEvents: currentSlide === i ? "auto" : "none",
                                            }}
                                        >
                                            <img src={url} alt={`שקף ${i + 1}`} className="w-full h-full object-contain" loading="eager" />
                                        </div>
                                    ))}
                                    {results.length > 1 && (
                                        <>
                                            <button
                                                onClick={() => setCurrentSlide((p) => (p + 1) % results.length)}
                                                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white/90 rounded-full shadow-lg"
                                                aria-label="תמונה הבאה"
                                            >
                                                <ChevronLeft className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => setCurrentSlide((p) => (p - 1 + results.length) % results.length)}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/90 rounded-full shadow-lg"
                                                aria-label="תמונה קודמת"
                                            >
                                                <ChevronRight className="w-5 h-5" />
                                            </button>
                                        </>
                                    )}
                                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded-full text-sm">
                                        {currentSlide + 1} / {results.length}
                                    </div>
                                </div>
                                <div className="flex gap-2 overflow-x-auto pb-2">
                                    {results.map((url, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setCurrentSlide(i)}
                                            className={`flex-shrink-0 w-16 h-20 rounded-lg overflow-hidden border-2 ${
                                                currentSlide === i ? "border-purple-500" : "border-transparent opacity-60"
                                            }`}
                                        >
                                            <img src={url} alt="" className="w-full h-full object-cover" />
                                        </button>
                                    ))}
                                </div>
                                <div className="mt-4">
                                    <ExportFormats 
                                        imageUrl={results[currentSlide]} 
                                        baseFilename={`carousel-slide-${currentSlide + 1}`}
                                    />
                                </div>
                            </div>
                        )}

                        {!loading && results.length === 0 && (
                            <div className="bg-gray-50 rounded-lg flex items-center justify-center border-2 border-dashed min-h-[500px]">
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
    );
}
