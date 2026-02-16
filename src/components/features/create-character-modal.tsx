"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface Props {
    open?: boolean;
    onClose: () => void;
    onCreated: () => void;
}

const GENDER_OPTIONS = [
    { value: "male", label: "גבר", emoji: "👨" },
    { value: "female", label: "אישה", emoji: "👩" },
];

const HAIR_OPTIONS = [
    { value: "short", label: "קצר", labelEn: "short hair" },
    { value: "medium", label: "בינוני", labelEn: "medium length hair" },
    { value: "long", label: "ארוך", labelEn: "long hair" },
    { value: "bald", label: "קירח", labelEn: "bald, no hair" },
    { value: "buzz", label: "מגולח", labelEn: "buzz cut" },
    { value: "curly", label: "מתולתל", labelEn: "curly hair" },
];

const HAIR_COLOR_OPTIONS = [
    { value: "black", label: "שחור", labelEn: "black hair" },
    { value: "brown", label: "חום", labelEn: "brown hair" },
    { value: "blonde", label: "בלונד", labelEn: "blonde hair" },
    { value: "red", label: "ג'ינג'י", labelEn: "red hair" },
    { value: "gray", label: "אפור/שיבה", labelEn: "gray hair" },
];

export function CreateCharacterModal({ open = true, onClose, onCreated }: Props) {
    if (!open) return null;

    const [name, setName] = useState("");
    const [gender, setGender] = useState<string>("");
    const [hairStyle, setHairStyle] = useState<string>("");
    const [hairColor, setHairColor] = useState<string>("");
    const [extraDescription, setExtraDescription] = useState("");
    const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Build structured description from selections
    const buildDescription = (): string => {
        const parts: string[] = [];

        const genderOpt = GENDER_OPTIONS.find((g) => g.value === gender);
        if (genderOpt) parts.push(`gender:${genderOpt.value}`);

        const hairOpt = HAIR_OPTIONS.find((h) => h.value === hairStyle);
        if (hairOpt) parts.push(`hair_style:${hairOpt.labelEn}`);

        const colorOpt = HAIR_COLOR_OPTIONS.find((c) => c.value === hairColor);
        if (colorOpt) parts.push(`hair_color:${colorOpt.labelEn}`);

        if (extraDescription.trim()) {
            parts.push(`notes:${extraDescription.trim()}`);
        }

        return parts.join(" | ");
    };

    const handleFileUpload = async (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        setUploading(true);
        setError(null);
        setUploadProgress(0);

        const validFiles = Array.from(files).filter((file) => {
            if (!file.type.startsWith("image/")) return false;
            if (file.size > 10 * 1024 * 1024) return false;
            return true;
        });

        if (validFiles.length === 0) {
            setError("לא נמצאו קבצי תמונה תקינים");
            setUploading(false);
            return;
        }

        const newUrls: string[] = [];
        let completed = 0;

        for (const file of validFiles) {
            try {
                const formData = new FormData();
                formData.append("file", file);

                const res = await fetch("/api/upload", {
                    method: "POST",
                    body: formData,
                });

                const data = await res.json();

                if (res.ok) {
                    if (data.url) {
                        newUrls.push(data.url);
                    } else if (data.urls && data.urls[0]) {
                        newUrls.push(data.urls[0]);
                    }
                } else {
                    console.error(`Upload failed for ${file.name}:`, data.error);
                }
            } catch (err) {
                console.error(`Upload error for ${file.name}:`, err);
            }

            completed++;
            setUploadProgress(Math.round((completed / validFiles.length) * 100));
        }

        if (newUrls.length > 0) {
            setUploadedUrls((prev) => [...prev, ...newUrls]);
        }

        setUploading(false);
        setUploadProgress(0);

        if (newUrls.length < validFiles.length) {
            setError(`${newUrls.length} מתוך ${validFiles.length} תמונות הועלו בהצלחה`);
        }

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleRemoveImage = (index: number) => {
        setUploadedUrls((prev) => prev.filter((_, i) => i !== index));
    };

    const handleCreate = async () => {
        setError(null);

        if (!name.trim()) {
            setError("יש להזין שם לדמות");
            return;
        }
        if (!gender) {
            setError("יש לבחור מין");
            return;
        }
        if (uploadedUrls.length < 5) {
            setError(`יש להעלות לפחות 5 תמונות. יש לך ${uploadedUrls.length}.`);
            return;
        }

        setCreating(true);

        try {
            const description = buildDescription();

            const res = await fetch("/api/characters", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    description,
                    reference_images: uploadedUrls,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "שגיאה ביצירת הדמות");
            }

            onCreated();
        } catch (err) {
            setError(err instanceof Error ? err.message : "שגיאה ביצירת הדמות");
        } finally {
            setCreating(false);
        }
    };

    const canCreate = name.trim().length > 0 && gender.length > 0 && uploadedUrls.length >= 5;

    return (
        <div
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <Card
                className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                dir="rtl"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-background z-10">
                    <h2 className="text-2xl font-bold">יצירת דמות חדשה</h2>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        ✕
                    </Button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Name */}
                    <div className="space-y-2">
                        <Label htmlFor="char-name" className="text-base font-semibold">
                            שם הדמות <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="char-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder='לדוגמה: "דני" או "שרה"'
                            dir="rtl"
                            maxLength={50}
                        />
                    </div>

                    {/* Gender */}
                    <div className="space-y-2">
                        <Label className="text-base font-semibold">
                            מין <span className="text-destructive">*</span>
                        </Label>
                        <div className="grid grid-cols-2 gap-3">
                            {GENDER_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => setGender(opt.value)}
                                    className={`p-3 rounded-lg border-2 text-center transition-all ${gender === opt.value
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:border-primary/50"
                                        }`}
                                >
                                    <div className="text-2xl mb-1">{opt.emoji}</div>
                                    <div className="text-sm font-medium">{opt.label}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Hair Style */}
                    <div className="space-y-2">
                        <Label className="text-base font-semibold">
                            סגנון שיער{" "}
                            <span className="text-muted-foreground font-normal text-sm">(מומלץ)</span>
                        </Label>
                        <div className="flex flex-wrap gap-2">
                            {HAIR_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() =>
                                        setHairStyle(hairStyle === opt.value ? "" : opt.value)
                                    }
                                    className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${hairStyle === opt.value
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "bg-background hover:bg-muted border-border"
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Hair Color */}
                    <div className="space-y-2">
                        <Label className="text-base font-semibold">
                            צבע שיער{" "}
                            <span className="text-muted-foreground font-normal text-sm">(מומלץ)</span>
                        </Label>
                        <div className="flex flex-wrap gap-2">
                            {HAIR_COLOR_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() =>
                                        setHairColor(hairColor === opt.value ? "" : opt.value)
                                    }
                                    className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${hairColor === opt.value
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "bg-background hover:bg-muted border-border"
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Extra Description */}
                    <div className="space-y-2">
                        <Label htmlFor="char-desc" className="text-base font-semibold">
                            תיאור נוסף{" "}
                            <span className="text-muted-foreground font-normal text-sm">
                                (אופציונלי)
                            </span>
                        </Label>
                        <Textarea
                            id="char-desc"
                            value={extraDescription}
                            onChange={(e) => setExtraDescription(e.target.value)}
                            placeholder="למשל: זקן, משקפיים, קעקועים, חיוך רחב..."
                            rows={2}
                            dir="rtl"
                            maxLength={200}
                        />
                    </div>

                    {/* Image Upload */}
                    <div className="space-y-3">
                        <Label className="text-base font-semibold">
                            תמונות אימון <span className="text-destructive">*</span>
                            <span className="text-muted-foreground font-normal text-sm block mt-0.5">
                                מינימום 5 תמונות, מומלץ 10-20
                            </span>
                        </Label>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            multiple
                            onChange={handleFileUpload}
                            className="hidden"
                        />

                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="w-full border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 rounded-xl p-8 text-center transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {uploading ? (
                                <div className="space-y-3">
                                    <div className="text-3xl animate-pulse">📤</div>
                                    <p className="font-medium">מעלה תמונות...</p>
                                    <Progress value={uploadProgress} className="max-w-xs mx-auto" />
                                    <p className="text-sm text-muted-foreground">
                                        {uploadProgress}%
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="text-4xl">📷</div>
                                    <p className="font-medium">לחץ לבחירת תמונות</p>
                                    <p className="text-sm text-muted-foreground">
                                        PNG, JPG, WEBP — עד 10MB לתמונה
                                    </p>
                                </div>
                            )}
                        </button>

                        {/* Image count indicator */}
                        <div className="flex items-center gap-2">
                            <div
                                className={`text-sm font-medium ${uploadedUrls.length >= 5
                                        ? "text-green-600"
                                        : "text-amber-600"
                                    }`}
                            >
                                {uploadedUrls.length >= 5 ? "✅" : "⚠️"} {uploadedUrls.length}
                                /20 תמונות (מינימום 5)
                            </div>
                            {uploadedUrls.length >= 10 && uploadedUrls.length < 20 && (
                                <span className="text-xs text-green-600">👍 כמות טובה</span>
                            )}
                            {uploadedUrls.length >= 20 && (
                                <span className="text-xs text-green-600">🎯 מעולה!</span>
                            )}
                        </div>

                        {/* Preview grid */}
                        {uploadedUrls.length > 0 && (
                            <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
                                {uploadedUrls.map((url, i) => (
                                    <div key={i} className="relative group aspect-square">
                                        <img
                                            src={url}
                                            alt={`תמונה ${i + 1}`}
                                            className="w-full h-full object-cover rounded-lg"
                                        />
                                        <button
                                            onClick={() => handleRemoveImage(i)}
                                            className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                            title="הסר תמונה"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}

                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                    className="aspect-square border-2 border-dashed border-muted-foreground/20 rounded-lg flex items-center justify-center text-muted-foreground hover:border-primary/50 transition-colors"
                                >
                                    +
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Tips */}
                    <div className="bg-blue-50 dark:bg-blue-950/50 rounded-xl p-4 space-y-2">
                        <p className="font-semibold text-sm flex items-center gap-1">
                            💡 טיפים לתמונות אימון טובות
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1 mr-5 list-disc">
                            <li>תמונות ברורות וחדות של הפנים</li>
                            <li>זוויות שונות — מלפנים, מהצד, ברבע פרופיל</li>
                            <li>תאורה טבעית ואחידה</li>
                            <li>ללא משקפי שמש, כובעים, או מסכות</li>
                            <li>רקעים פשוטים עדיפים</li>
                            <li>הביטויים שונים — חיוך, רציני, צוחק</li>
                        </ul>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <Button
                            onClick={handleCreate}
                            disabled={creating || !canCreate}
                            className="flex-1"
                            size="lg"
                        >
                            {creating ? (
                                <span className="flex items-center gap-2">
                                    <span className="animate-spin">⏳</span>
                                    יוצר דמות...
                                </span>
                            ) : (
                                "✨ צור דמות (50 קרדיטים)"
                            )}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={onClose}
                            disabled={creating}
                            size="lg"
                        >
                            ביטול
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}