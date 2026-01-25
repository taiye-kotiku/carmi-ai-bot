// src/components/features/delete-character-modal.tsx
"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Character } from "@/types/database";
import { toast } from "sonner";

interface DeleteCharacterModalProps {
    character: Character;
    onClose: () => void;
    onDeleted: () => void;
}

export function DeleteCharacterModal({
    character,
    onClose,
    onDeleted,
}: DeleteCharacterModalProps) {
    const [deleting, setDeleting] = useState(false);

    async function handleDelete() {
        setDeleting(true);
        try {
            const res = await fetch(`/api/characters/${character.id}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error);
            }

            toast.success("הדמות נמחקה בהצלחה");
            onDeleted();
            onClose();
        } catch (err: any) {
            toast.error(err.message || "שגיאה במחיקת הדמות");
        } finally {
            setDeleting(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm">
                {/* Icon */}
                <div className="flex justify-center mb-4">
                    <div className="h-14 w-14 bg-red-100 rounded-full flex items-center justify-center">
                        <AlertTriangle className="h-7 w-7 text-red-600" />
                    </div>
                </div>

                {/* Content */}
                <div className="text-center mb-6">
                    <h2 className="text-xl font-bold mb-2">מחיקת דמות</h2>
                    <p className="text-gray-600">
                        האם אתה בטוח שברצונך למחוק את{" "}
                        <span className="font-semibold">{character.name}</span>?
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                        פעולה זו לא ניתנת לביטול. תמונות שנוצרו עם הדמות יישארו בגלריה.
                    </p>
                </div>

                {/* Character Preview */}
                <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 mb-6">
                    <img
                        src={character.thumbnail_url || character.reference_images[0]}
                        alt={character.name}
                        className="w-12 h-12 rounded-lg object-cover"
                    />
                    <div>
                        <p className="font-medium">{character.name}</p>
                        <p className="text-sm text-gray-500">
                            {character.reference_images.length} תמונות ייחוס
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="flex-1"
                        disabled={deleting}
                    >
                        ביטול
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex-1"
                    >
                        {deleting && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                        מחק דמות
                    </Button>
                </div>
            </div>
        </div>
    );
}