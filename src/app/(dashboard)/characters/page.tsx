// src/app/(dashboard)/characters/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CreateCharacterModal } from "@/components/features/create-character-modal";
import { DeleteCharacterModal } from "@/components/features/delete-character-modal";
import type { Character } from "@/types/database";

const STATUS_CONFIG: Record<
    Character["status"],
    { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
    pending: { label: "ממתין לאימון", variant: "outline" },
    training: { label: "מאמן...", variant: "secondary" },
    ready: { label: "מוכן", variant: "default" },
    failed: { label: "נכשל", variant: "destructive" },
};

// Estimate training time based on typical FLUX training
function getTrainingProgress(startedAt: string | null): number {
    if (!startedAt) return 0;
    const elapsed = Date.now() - new Date(startedAt).getTime();
    const estimatedTotal = 45 * 60 * 1000; // 45 minutes
    return Math.min(Math.round((elapsed / estimatedTotal) * 100), 95);
}

function getElapsedMinutes(startedAt: string | null): number {
    if (!startedAt) return 0;
    return Math.round((Date.now() - new Date(startedAt).getTime()) / 60000);
}

export default function CharactersPage() {
    const [characters, setCharacters] = useState<Character[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Character | null>(null);
    const [trainingId, setTrainingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchCharacters = useCallback(async () => {
        try {
            const res = await fetch("/api/characters");
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            setCharacters(data.characters || []);
        } catch (err) {
            console.error("Failed to fetch characters:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCharacters();
    }, [fetchCharacters]);

    // Poll when any character is training
    useEffect(() => {
        const hasTraining = characters.some((c) => c.status === "training");
        if (!hasTraining) return;

        const interval = setInterval(fetchCharacters, 10000);
        return () => clearInterval(interval);
    }, [characters, fetchCharacters]);

    const handleStartTraining = async (characterId: string) => {
        setTrainingId(characterId);
        setError(null);

        try {
            const res = await fetch(`/api/characters/${characterId}/train`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "שגיאה בהתחלת האימון");
                return;
            }

            await fetchCharacters();
        } catch (err) {
            console.error("Training error:", err);
            setError("שגיאה בהתחלת האימון");
        } finally {
            setTrainingId(null);
        }
    };

    const handleDelete = async (characterId: string) => {
        try {
            const res = await fetch(`/api/characters/${characterId}`, {
                method: "DELETE",
            });

            if (res.ok) {
                setCharacters((prev) => prev.filter((c) => c.id !== characterId));
            } else {
                const data = await res.json();
                setError(data.error || "שגיאה במחיקה");
            }
        } catch (err) {
            console.error("Delete error:", err);
            setError("שגיאה במחיקה");
        }
        setDeleteTarget(null);
    };

    // Loading skeleton
    if (loading) {
        return (
            <div className="container mx-auto p-6" dir="rtl">
                <div className="flex items-center justify-between mb-8">
                    <div className="h-9 w-40 bg-muted animate-pulse rounded" />
                    <div className="h-10 w-36 bg-muted animate-pulse rounded" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-72 bg-muted animate-pulse rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold">הדמויות שלי</h1>
                    <p className="text-muted-foreground mt-1">
                        צור ואמן דמויות מותאמות אישית ליצירת תוכן
                    </p>
                </div>
                <Button onClick={() => setShowCreateModal(true)} size="lg">
                    <span className="ml-2">+</span>
                    דמות חדשה
                </Button>
            </div>

            {/* Global error */}
            {error && (
                <div className="bg-destructive/10 text-destructive rounded-lg p-4 mb-6 flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="text-sm underline">
                        סגור
                    </button>
                </div>
            )}

            {/* Empty state */}
            {characters.length === 0 ? (
                <Card className="p-16 text-center">
                    <div className="text-6xl mb-6">🎭</div>
                    <h2 className="text-2xl font-semibold mb-3">אין דמויות עדיין</h2>
                    <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                        העלה תמונות של אדם כדי לאמן מודל AI מותאם אישית.
                        לאחר האימון תוכל ליצור תמונות חדשות של הדמות בכל סגנון וסצנה.
                    </p>
                    <Button onClick={() => setShowCreateModal(true)} size="lg">
                        צור את הדמות הראשונה שלך
                    </Button>
                </Card>
            ) : (
                /* Character grid */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {characters.map((character) => {
                        const statusConfig = STATUS_CONFIG[character.status];
                        const isTraining = character.status === "training";
                        const isReady = character.status === "ready";
                        const isPending = character.status === "pending";
                        const isFailed = character.status === "failed";

                        return (
                            <Card
                                key={character.id}
                                className={`overflow-hidden transition-all hover:shadow-lg ${isTraining ? "ring-2 ring-blue-400 ring-offset-2" : ""
                                    }`}
                            >
                                {/* Image preview grid */}
                                <div className="grid grid-cols-3 gap-0.5 h-36 bg-muted">
                                    {character.reference_images.slice(0, 3).map((url, i) => (
                                        <div key={i} className="overflow-hidden">
                                            <img
                                                src={url}
                                                alt={`${character.name} ${i + 1}`}
                                                className="w-full h-full object-cover hover:scale-105 transition-transform"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src =
                                                        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23e2e8f0' width='100' height='100'/%3E%3Ctext x='50' y='55' text-anchor='middle' fill='%2394a3b8' font-size='30'%3E🖼️%3C/text%3E%3C/svg%3E";
                                                }}
                                            />
                                        </div>
                                    ))}
                                    {character.reference_images.length > 3 && (
                                        <div className="col-span-3 bg-muted/50 text-center text-xs text-muted-foreground py-1">
                                            +{character.reference_images.length - 3} תמונות נוספות
                                        </div>
                                    )}
                                </div>

                                <div className="p-4 space-y-3">
                                    {/* Name + status */}
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-bold truncate ml-2">
                                            {character.name}
                                        </h3>
                                        <Badge variant={statusConfig.variant}>
                                            {statusConfig.label}
                                        </Badge>
                                    </div>

                                    {/* Description */}
                                    {character.description && (
                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                            {character.description}
                                        </p>
                                    )}

                                    {/* Image count */}
                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                        <span>📸</span>
                                        <span>{character.reference_images.length} תמונות אימון</span>
                                    </div>

                                    {/* Training progress */}
                                    {isTraining && (
                                        <div className="space-y-2">
                                            <Progress
                                                value={getTrainingProgress(character.training_started_at)}
                                            />
                                            <p className="text-xs text-blue-600 animate-pulse flex items-center gap-1">
                                                <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-ping" />
                                                אימון בתהליך —{" "}
                                                {getElapsedMinutes(character.training_started_at)} דקות
                                                (בערך 30-60 דקות)
                                            </p>
                                        </div>
                                    )}

                                    {/* Error */}
                                    {isFailed && character.error_message && (
                                        <div className="bg-destructive/10 rounded-md p-2">
                                            <p className="text-xs text-destructive">
                                                {character.error_message}
                                            </p>
                                        </div>
                                    )}

                                    {/* Action buttons */}
                                    <div className="flex gap-2 pt-2">
                                        {isPending && (
                                            <Button
                                                onClick={() => handleStartTraining(character.id)}
                                                disabled={trainingId === character.id}
                                                className="flex-1"
                                            >
                                                {trainingId === character.id ? (
                                                    <span className="flex items-center gap-2">
                                                        <span className="animate-spin">⏳</span>
                                                        מתחיל...
                                                    </span>
                                                ) : (
                                                    "🚀 התחל אימון"
                                                )}
                                            </Button>
                                        )}

                                        {isFailed && (
                                            <Button
                                                onClick={() => handleStartTraining(character.id)}
                                                disabled={trainingId === character.id}
                                                variant="outline"
                                                className="flex-1"
                                            >
                                                🔄 נסה שוב
                                            </Button>
                                        )}

                                        {isReady && (
                                            <Button asChild className="flex-1">
                                                <a href={`/generate/character?id=${character.id}`}>
                                                    ✨ צור תמונה
                                                </a>
                                            </Button>
                                        )}

                                        {isTraining && (
                                            <Button disabled variant="outline" className="flex-1">
                                                ⏳ ממתין לאימון...
                                            </Button>
                                        )}

                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setDeleteTarget(character)}
                                            disabled={isTraining}
                                            className="shrink-0 text-muted-foreground hover:text-destructive"
                                            title="מחק דמות"
                                        >
                                            🗑️
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <CreateCharacterModal
                    onClose={() => setShowCreateModal(false)}
                    onCreated={() => {
                        setShowCreateModal(false);
                        fetchCharacters();
                    }}
                />
            )}

            {/* Delete Modal */}
            {deleteTarget && (
                <DeleteCharacterModal
                    character={deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    onConfirm={() => handleDelete(deleteTarget.id)}
                />
            )}
        </div>
    );
}