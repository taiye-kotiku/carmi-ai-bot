// src/components/features/edit-character-modal.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import type { Character } from "@/types/database";

interface Props {
    character: Character;
    onClose: () => void;
    onUpdated: () => void;
}

export function EditCharacterModal({ character, onClose, onUpdated }: Props) {
    const [name, setName] = useState(character.name);
    const [description, setDescription] = useState(character.description || "");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSave = async () => {
        if (!name.trim()) {
            setError("שם הדמות הוא שדה חובה");
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const res = await fetch(`/api/characters/${character.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    description: description.trim() || null,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "שגיאה בעדכון");
            }

            onUpdated();
        } catch (err) {
            setError(err instanceof Error ? err.message : "שגיאה בעדכון");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <Card className="w-full max-w-md p-6" dir="rtl">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold">עריכת דמות</h2>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        ✕
                    </Button>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-name">שם</Label>
                        <Input
                            id="edit-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            dir="rtl"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-desc">תיאור</Label>
                        <Textarea
                            id="edit-desc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            dir="rtl"
                        />
                    </div>

                    {error && (
                        <p className="text-sm text-destructive">{error}</p>
                    )}

                    <div className="flex gap-3 pt-2">
                        <Button
                            onClick={handleSave}
                            disabled={saving || !name.trim()}
                            className="flex-1"
                        >
                            {saving ? "שומר..." : "💾 שמור"}
                        </Button>
                        <Button variant="outline" onClick={onClose} disabled={saving}>
                            ביטול
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}