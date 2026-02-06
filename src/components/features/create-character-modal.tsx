// src/components/features/create-character-modal.tsx
"use client";

import { useState } from "react";
import { X, Upload, Loader2, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface CreateCharacterModalProps {
    open: boolean;
    onClose: () => void;
    onCreated: () => void;
}

export function CreateCharacterModal({
    open,
    onClose,
    onCreated,
}: CreateCharacterModalProps) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [images, setImages] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const [creating, setCreating] = useState(false);

    const MIN_IMAGES = 15;
    const MAX_IMAGES = 30;
    const RECOMMENDED_IMAGES = 20;
    const canTrain = images.length >= MIN_IMAGES;

    async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files;
        if (!files?.length) return;

        if (images.length + files.length > MAX_IMAGES) {
            toast.error(`ניתן להעלות עד ${MAX_IMAGES} תמונות`);
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            Array.from(files).forEach((file) => formData.append("files", file));

            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) throw new Error("Upload failed");

            const data = await res.json();
            setImages((prev) => [...prev, ...data.urls]);
        } catch (err) {
            toast.error("שגיאה בהעלאת התמונות");
        } finally {
            setUploading(false);
        }
    }

    function removeImage(index: number) {
        setImages((prev) => prev.filter((_, i) => i !== index));
    }

    async function handleCreate() {
        if (!name.trim()) {
            toast.error("נא להזין שם לדמות");
            return;
        }
        if (images.length < MIN_IMAGES) {
            toast.error(`נא להעלות לפחות ${MIN_IMAGES} תמונות (מומלץ ${RECOMMENDED_IMAGES} מזוויות, בגדים ורקעים שונים)`);
            return;
        }

        setCreating(true);
        try {
            const res = await fetch("/api/characters", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    description,
                    reference_images: images,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error);
            }

            if (canTrain) {
                toast.success("הדמות נוצרה! לחץ על 'התחל אימון' בדף הדמויות");
            } else {
                toast.success(`הדמות נוצרה! הוסף עוד ${MIN_IMAGES - images.length} תמונות כדי לאפשר אימון`);
            }

            onCreated();
            handleClose();
        } catch (err: any) {
            toast.error(err.message || "שגיאה ביצירת הדמות");
        } finally {
            setCreating(false);
        }
    }

    function handleClose() {
        setName("");
        setDescription("");
        setImages([]);
        onClose();
    }

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/50"
                onClick={handleClose}
            />
            <div className="relative bg-white rounded-2xl p-6 w-full max-w-md space-y-5 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold">יצירת דמות חדשה</h2>
                    <button
                        onClick={handleClose}
                        className="p-1 hover:bg-gray-100 rounded-lg"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Name */}
                <div className="space-y-2">
                    <Label>שם הדמות</Label>
                    <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="לדוגמה: דני, השף שלי..."
                    />
                </div>

                {/* Description */}
                <div className="space-y-2">
                    <Label>תיאור (אופציונלי)</Label>
                    <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="תאר את הדמות - גיל, מאפיינים, סגנון..."
                        rows={2}
                    />
                </div>

                {/* Images */}
                <div className="space-y-2">
                    <Label>תמונות ייחוס (כ-20 מזוויות, בגדים ורקעים שונים)</Label>
                    <div className="grid grid-cols-4 gap-2">
                        {images.map((url, i) => (
                            <div key={i} className="relative aspect-square">
                                <img
                                    src={url}
                                    alt={`Reference ${i + 1}`}
                                    className="w-full h-full object-cover rounded-lg"
                                />
                                <button
                                    onClick={() => removeImage(i)}
                                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                        {images.length < MAX_IMAGES && (
                            <label className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                                {uploading ? (
                                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                                ) : (
                                    <Upload className="w-5 h-5 text-gray-400" />
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleImageUpload}
                                    className="hidden"
                                    disabled={uploading}
                                />
                            </label>
                        )}
                    </div>

                    {/* Training info box */}
                    <div className={`p-3 rounded-lg text-sm ${canTrain ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                        {canTrain ? (
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4" />
                                <span>מעולה! {images.length} תמונות - תוכל ללחוץ "התחל אימון" לאחר השמירה</span>
                            </div>
                        ) : (
                            <span>💡 העלה כ-20 תמונות מזוויות שונות, בגדים ורקעים לאימון LoRA איכותי</span>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        className="flex-1"
                    >
                        ביטול
                    </Button>
                    <Button
                        onClick={handleCreate}
                        disabled={!name.trim() || !images.length || creating}
                        className="flex-1"
                    >
                        {creating ? (
                            <Loader2 className="w-4 h-4 animate-spin ml-2" />
                        ) : null}
                        {canTrain ? "צור דמות" : "צור דמות"}
                    </Button>
                </div>
            </div>
        </div>
    );
}