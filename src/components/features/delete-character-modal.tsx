// src/components/features/delete-character-modal.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Character } from "@/types/database";

interface Props {
    character: Character;
    onClose: () => void;
    onConfirm: () => void;
}

export function DeleteCharacterModal({ character, onClose, onConfirm }: Props) {
    const [deleting, setDeleting] = useState(false);

    const handleConfirm = async () => {
        setDeleting(true);
        await onConfirm();
        setDeleting(false);
    };

    return (
        <div
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget && !deleting) onClose();
            }}
        >
            <Card className="w-full max-w-md p-6" dir="rtl">
                <div className="text-center space-y-4">
                    <div className="text-5xl">⚠️</div>
                    <h2 className="text-xl font-bold">מחיקת דמות</h2>
                    <p className="text-muted-foreground">
                        האם אתה בטוח שברצונך למחוק את הדמות{" "}
                        <strong>&ldquo;{character.name}&rdquo;</strong>?
                    </p>
                    <p className="text-sm text-destructive">
                        פעולה זו תמחק את כל תמונות האימון והמודל המאומן. לא ניתן לבטל.
                    </p>
                </div>

                <div className="flex gap-3 mt-6">
                    <Button
                        variant="destructive"
                        onClick={handleConfirm}
                        disabled={deleting}
                        className="flex-1"
                    >
                        {deleting ? "מוחק..." : "🗑️ מחק"}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={deleting}
                        className="flex-1"
                    >
                        ביטול
                    </Button>
                </div>
            </Card>
        </div>
    );
}