// src/components/features/create-character-modal.tsx
"use client";

import { useState } from "react";
import { X, Upload, Loader2, Trash2 } from "lucide-react";
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

    async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files;
        if (!files?.length) return;

        if (images.length + files.length > 4) {
            toast.error("ניתן להעלות עד 4 תמונות");
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
        if (!images.length) {
            toast.error("נא להעלות לפחות תמונה אחת");
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

            toast.success("הדמות נוצרה בהצלחה! 🎉");
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
                    <p className="text-xs text-gray-500">
                        התיאור עוזר לשמור על עקביות טובה יותר
                    </p>
                </div>

                {/* Images */}
                <div className="space-y-2">
                    <Label>תמונות ייחוס (1-4)</Label>
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
                        {images.length < 4 && (
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
                    <p className="text-xs text-gray-500">
                        💡 העלה תמונות ברורות של הפנים מזוויות שונות לתוצאות הטובות ביותר
                    </p>
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
                        צור דמות
                    </Button>
                </div>
            </div>
        </div>
    );
}