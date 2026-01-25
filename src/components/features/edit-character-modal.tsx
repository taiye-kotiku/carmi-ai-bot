// src/components/features/edit-character-modal.tsx
"use client";

import { useState } from "react";
import { X, Upload, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Character } from "@/types/database";
import { toast } from "sonner";

interface EditCharacterModalProps {
    character: Character;
    onClose: () => void;
    onUpdated: () => void;
}

export function EditCharacterModal({
    character,
    onClose,
    onUpdated,
}: EditCharacterModalProps) {
    const [name, setName] = useState(character.name);
    const [description, setDescription] = useState(character.description || "");
    const [images, setImages] = useState<string[]>(character.reference_images);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);

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
        if (images.length <= 1) {
            toast.error("חייבת להיות לפחות תמונה אחת");
            return;
        }
        setImages((prev) => prev.filter((_, i) => i !== index));
    }

    async function handleSave() {
        if (!name.trim()) {
            toast.error("נא להזין שם לדמות");
            return;
        }
        if (!images.length) {
            toast.error("נא להעלות לפחות תמונה אחת");
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(`/api/characters/${character.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    description: description || null,
                    reference_images: images,
                    thumbnail_url: images[0],
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error);
            }

            toast.success("הדמות עודכנה בהצלחה!");
            onUpdated();
            onClose();
        } catch (err: any) {
            toast.error(err.message || "שגיאה בעדכון הדמות");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white rounded-2xl p-6 w-full max-w-md space-y-5 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold">עריכת דמות</h2>
                    <button
                        onClick={onClose}
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
                    <Label>תמונות ייחוס ({images.length}/4)</Label>
                    <div className="grid grid-cols-4 gap-2">
                        {images.map((url, i) => (
                            <div key={i} className="relative aspect-square group">
                                <img
                                    src={url}
                                    alt={`Reference ${i + 1}`}
                                    className="w-full h-full object-cover rounded-lg"
                                />
                                <button
                                    onClick={() => removeImage(i)}
                                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                                {i === 0 && (
                                    <div className="absolute bottom-0 left-0 right-0 bg-purple-600 text-white text-[10px] text-center py-0.5 rounded-b-lg">
                                        ראשית
                                    </div>
                                )}
                            </div>
                        ))}
                        {images.length < 4 && (
                            <label className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-purple-400 transition-colors">
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
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                    <Button variant="outline" onClick={onClose} className="flex-1">
                        ביטול
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={!name.trim() || !images.length || saving}
                        className="flex-1"
                    >
                        {saving && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                        שמור שינויים
                    </Button>
                </div>
            </div>
        </div>
    );
}