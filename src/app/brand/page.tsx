"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Loader2, Upload, Palette, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const LOGO_POSITIONS = [
    { value: "top-left", label: "פינה עליונה שמאל" },
    { value: "top-middle", label: "מרכז עליון" },
    { value: "top-right", label: "פינה עליונה ימין" },
    { value: "bottom-left", label: "פינה תחתונה שמאל" },
    { value: "bottom-middle", label: "מרכז תחתון" },
    { value: "bottom-right", label: "פינה תחתונה ימין" },
];

const BRAND_COLORS = [
    "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
    "#f97316", "#eab308", "#22c55e", "#06b6d4",
    "#3b82f6", "#1e293b",
];

export default function BrandPage() {
    const [brandName, setBrandName] = useState("");
    const [tagline, setTagline] = useState("");
    const [primaryColor, setPrimaryColor] = useState("#6366f1");
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [logoPosition, setLogoPosition] = useState("top-right");
    const [logoOpacity, setLogoOpacity] = useState(0.9);
    const [isEnabled, setIsEnabled] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchBrand();
    }, []);

    async function fetchBrand() {
        try {
            const res = await fetch("/api/brand");
            if (res.ok) {
                const data = await res.json();
                if (data) {
                    setBrandName(data.name || "");
                    setTagline(data.tagline || "");
                    setPrimaryColor(data.primary_color || "#6366f1");
                    setLogoUrl(data.logo_url || null);
                    setLogoPosition(data.logo_position || "top-right");
                    setLogoOpacity(data.logo_opacity ?? 0.9);
                    setIsEnabled(data.is_enabled ?? true);
                }
            }
            // 401 = not logged in - show empty form as preview
        } catch (err) {
            // Ignore when not logged in
        } finally {
            setLoading(false);
        }
    }

    async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !file.type.startsWith("image/")) {
            toast.error("נא להעלות קובץ תמונה (PNG, JPG)");
            return;
        }
        try {
            const formData = new FormData();
            formData.append("logo", file);
            const res = await fetch("/api/upload/logo", { method: "POST", body: formData });
            if (res.status === 401) {
                // Preview: show local image
                const url = URL.createObjectURL(file);
                setLogoUrl(url);
                toast.info("תצוגה מקדימה – התחבר כדי לשמור");
                e.target.value = "";
                return;
            }
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || "שגיאה");
            }
            const { url } = await res.json();
            setLogoUrl(url);
            toast.success("הלוגו הועלה");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "שגיאה בהעלאה");
        }
        e.target.value = "";
    }

    async function handleSave() {
        setSaving(true);
        try {
            const res = await fetch("/api/brand", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: brandName,
                    tagline: tagline || null,
                    primary_color: primaryColor,
                    logo_url: logoUrl,
                    logo_position: logoPosition,
                    logo_opacity: logoOpacity,
                    is_enabled: isEnabled,
                }),
            });
            if (res.status === 401) {
                toast.error("התחבר כדי לשמור את ההגדרות");
                return;
            }
            if (!res.ok) throw new Error("שגיאה בשמירה");
            toast.success("ההגדרות נשמרו בהצלחה");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "שגיאה");
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center" dir="rtl">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8" dir="rtl">
            <div className="max-w-2xl mx-auto">
                <div className="mb-4 flex items-center justify-between">
                    <a href="/" className="text-sm text-gray-500 hover:text-gray-700">← חזרה לדף הבית</a>
                </div>
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900">הגדרות מיתוג</h1>
                    <p className="text-gray-500 mt-1">
                        הלוגו והצבעים שלך יופיעו אוטומטית בקרוסלות, תמונות וסרטונים
                    </p>
                    <p className="text-amber-600 text-sm mt-2 bg-amber-50 px-3 py-2 rounded-lg">
                        תצוגה מקדימה – <a href="/login" className="underline font-medium">התחבר</a> כדי לשמור הגדרות
                    </p>
                </div>

                <Card>
                    <CardContent className="p-6 space-y-6">
                        <div>
                            <Label>שם המותג</Label>
                            <Input
                                value={brandName}
                                onChange={(e) => setBrandName(e.target.value)}
                                placeholder="הכנס שם מותג..."
                                className="mt-2"
                            />
                        </div>

                        <div>
                            <Label>סלוגן (אופציונלי)</Label>
                            <Input
                                value={tagline}
                                onChange={(e) => setTagline(e.target.value)}
                                placeholder="משפט קצר שמתאר את המותג"
                                className="mt-2"
                            />
                        </div>

                        <div>
                            <Label>לוגו</Label>
                            <div className="mt-2 flex items-center gap-4">
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-purple-400 hover:bg-purple-50/50 transition-colors"
                                >
                                    {logoUrl ? (
                                        <img src={logoUrl} alt="לוגו" className="w-full h-full object-contain rounded-xl" />
                                    ) : (
                                        <>
                                            <Upload className="h-8 w-8 text-gray-400" />
                                            <span className="text-xs text-gray-500 mt-1">לחץ להעלאה</span>
                                        </>
                                    )}
                                </div>
                                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                                <div>
                                    <p className="text-sm text-gray-500">PNG או JPG, עד 5MB</p>
                                    {logoUrl && (
                                        <button onClick={() => setLogoUrl(null)} className="text-sm text-red-500 hover:underline mt-1">
                                            הסר לוגו
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div>
                            <Label>מיקום הלוגו בקרוסלות</Label>
                            <div className="grid grid-cols-3 gap-2 mt-2">
                                {LOGO_POSITIONS.map((p) => (
                                    <button
                                        key={p.value}
                                        onClick={() => setLogoPosition(p.value)}
                                        className={`p-2 rounded-lg border text-xs text-center ${
                                            logoPosition === p.value ? "border-purple-500 bg-purple-50" : "border-gray-200"
                                        }`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <Label>שקיפות הלוגו</Label>
                            <div className="flex items-center gap-3 mt-2">
                                <input
                                    type="range"
                                    min="0.3"
                                    max="1"
                                    step="0.1"
                                    value={logoOpacity}
                                    onChange={(e) => setLogoOpacity(parseFloat(e.target.value))}
                                    className="flex-1"
                                />
                                <span className="text-sm text-gray-500 w-12">{Math.round(logoOpacity * 100)}%</span>
                            </div>
                        </div>

                        <div>
                            <Label>צבע מותג ראשי</Label>
                            <p className="text-sm text-gray-500 mt-1 mb-2">ישמש בקרוסלות ובממשק</p>
                            <div className="flex flex-wrap gap-2">
                                {BRAND_COLORS.map((color) => (
                                    <button
                                        key={color}
                                        onClick={() => setPrimaryColor(color)}
                                        className={`w-10 h-10 rounded-full border-2 transition-all ${
                                            primaryColor === color ? "border-gray-900 scale-110" : "border-transparent"
                                        }`}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                                <Palette className="h-5 w-5 text-gray-400" />
                                <Input
                                    value={primaryColor}
                                    onChange={(e) => setPrimaryColor(e.target.value)}
                                    className="w-28 font-mono"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="enabled"
                                checked={isEnabled}
                                onChange={(e) => setIsEnabled(e.target.checked)}
                                className="rounded"
                            />
                            <Label htmlFor="enabled" className="cursor-pointer">הפעל מיתוג אוטומטי בתוצרים</Label>
                        </div>

                        <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
                            {saving ? <Loader2 className="h-5 w-5 animate-spin ml-2" /> : <Save className="h-5 w-5 ml-2" />}
                            שמור הגדרות
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
