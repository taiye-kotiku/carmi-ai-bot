"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Loader2, Image as ImageIcon, Video, MoreVertical, Trash2, RefreshCw } from "lucide-react";
import { CreateCharacterModal } from "@/components/features/create-character-modal";
import Link from "next/link";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { DeleteCharacterModal } from "@/components/features/delete-character-modal";
import { toast } from "sonner";

interface Character {
    id: string;
    name: string;
    description: string;
    image_urls: string[];
    status: "draft" | "pending" | "training" | "ready" | "trained" | "failed";
    created_at: string;
    trigger_word?: string;
}

export default function CharactersPage() {
    const [characters, setCharacters] = useState<Character[]>([]);
    const [loading, setLoading] = useState(true); // only true on initial load
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [restartingId, setRestartingId] = useState<string | null>(null);

    const pollInterval = useRef<NodeJS.Timeout | null>(null);
    const hasFetchedOnce = useRef(false);

    const fetchCharacters = useCallback(async () => {
        // Only show loading skeleton on first fetch
        if (!hasFetchedOnce.current) {
            setLoading(true);
        }

        try {
            const res = await fetch(`/api/characters?t=${Date.now()}`);
            const data = await res.json();

            const charactersArray = Array.isArray(data) ? data : data.characters;

            if (charactersArray) {
                setCharacters(charactersArray);

                const hasTraining = charactersArray.some(
                    (c: Character) => c.status === "training"
                );
                if (hasTraining) {
                    startPolling();
                } else {
                    stopPolling();
                }
            }
        } catch (error) {
            console.error("Failed to load characters", error);
            if (!hasFetchedOnce.current) {
                toast.error("לא ניתן לטעון את הדמויות");
            }
        } finally {
            setLoading(false);
            hasFetchedOnce.current = true;
        }
    }, []);

    const startPolling = useCallback(() => {
        if (pollInterval.current) return;
        pollInterval.current = setInterval(fetchCharacters, 5000);
    }, [fetchCharacters]);

    const stopPolling = useCallback(() => {
        if (pollInterval.current) {
            clearInterval(pollInterval.current);
            pollInterval.current = null;
        }
    }, []);

    useEffect(() => {
        fetchCharacters();
        return () => stopPolling();
    }, [fetchCharacters, stopPolling]);

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await fetch(`/api/characters/${deleteId}`, { method: "DELETE" });
            fetchCharacters();
            setDeleteId(null);
            toast.success("הדמות נמחקה");
        } catch (e) {
            toast.error("שגיאה במחיקת הדמות");
        }
    };

    const handleResumeTraining = async (charId: string) => {
        setRestartingId(charId);
        try {
            setCharacters(prev =>
                prev.map(c =>
                    c.id === charId ? { ...c, status: "training" as const } : c
                )
            );

            const res = await fetch(`/api/characters/${charId}/train`, { method: "POST" });

            if (!res.ok) {
                const err = await res.json();
                toast.error(err.error || "התחלת האימון נכשלה");
                fetchCharacters();
            } else {
                await fetchCharacters();
                toast.success("האימון התחיל! זה ייקח מספר דקות.");
                startPolling();
            }
        } catch (e) {
            console.error(e);
            toast.error("שגיאה בהתחלת האימון");
            fetchCharacters();
        } finally {
            setRestartingId(null);
        }
    };

    // Helper: treat "trained" the same as "ready" (safety fallback)
    const isReady = (status: string) => status === "ready" || status === "trained";

    const renderStatus = (status: string) => {
        if (isReady(status)) {
            return (
                <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full text-xs font-medium border border-green-200">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />מוכן לשימוש
                </span>
            );
        }
        switch (status) {
            case "training":
                return (
                    <span className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full text-xs font-medium border border-blue-200 animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin" />מאמן מודל...
                    </span>
                );
            case "failed":
                return (
                    <span className="inline-flex items-center gap-1.5 bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full text-xs font-medium border border-red-200">
                        נכשל
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full text-xs font-medium border border-gray-200">
                        ממתין לאימון
                    </span>
                );
        }
    };

    return (
        <div className="container mx-auto p-6 max-w-7xl" dir="rtl">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold">הדמויות שלי</h1>
                    <p className="text-muted-foreground">נהל את הדמויות שלך וצור תוכן</p>
                </div>
                <Button onClick={() => setIsCreateOpen(true)} className="gap-2 shadow-lg">
                    <Plus className="w-4 h-4" />
                    דמות חדשה
                </Button>
            </div>

            {loading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-64 bg-muted/20 animate-pulse rounded-xl border" />
                    ))}
                </div>
            )}

            {!loading && characters.length === 0 && (
                <div className="text-center py-20 bg-muted/10 rounded-2xl border-2 border-dashed">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">👤</div>
                    <h3 className="text-xl font-semibold mb-2">אין לך דמויות עדיין</h3>
                    <p className="text-muted-foreground mb-6">צור את הדמות הראשונה שלך כדי להתחיל</p>
                    <Button onClick={() => setIsCreateOpen(true)}>צור דמות ראשונה</Button>
                </div>
            )}

            {!loading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {characters.map((char) => (
                        <Card key={char.id} className="overflow-hidden group hover:shadow-md transition-shadow relative">
                            <div className="absolute top-3 left-3 z-10">{renderStatus(char.status)}</div>
                            <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full bg-white/90 shadow-sm backdrop-blur">
                                            <MoreVertical className="w-4 h-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteId(char.id)}>
                                            <Trash2 className="w-4 h-4 mr-2" />מחק דמות
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className="aspect-square bg-muted relative">
                                {char.image_urls?.[0] ? (
                                    <img
                                        src={char.image_urls[0]}
                                        alt={char.name}
                                        className={`w-full h-full object-cover transition-opacity ${char.status === 'training' ? 'opacity-80' : ''}`}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-blue-50 to-purple-50">👤</div>
                                )}
                                {char.status === 'training' && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
                                        <div className="bg-white/90 px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                            <span className="text-sm font-medium">לומד את הפנים...</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-5">
                                <h3 className="font-bold text-lg mb-1">{char.name}</h3>
                                <p className="text-sm text-muted-foreground line-clamp-2 h-10 mb-4">
                                    {char.description || "ללא תיאור"}
                                </p>

                                <div className="grid grid-cols-2 gap-2">
                                    {isReady(char.status) ? (
                                        <>
                                            <Button asChild variant="default" size="sm" className="w-full">
                                                <Link href={`/generate/character?id=${char.id}`}>
                                                    <ImageIcon className="w-4 h-4 ml-2" />תמונה
                                                </Link>
                                            </Button>
                                            <Button asChild variant="outline" size="sm" className="w-full">
                                                <Link href={`/generate/character-video`}>
                                                    <Video className="w-4 h-4 ml-2" />וידאו
                                                </Link>
                                            </Button>
                                        </>
                                    ) : char.status === "training" ? (
                                        <Button disabled className="w-full col-span-2 bg-muted text-muted-foreground">
                                            <Loader2 className="w-4 h-4 ml-2 animate-spin" />תהליך אימון בעיצומו...
                                        </Button>
                                    ) : (
                                        <Button
                                            className="w-full col-span-2"
                                            disabled={restartingId === char.id}
                                            onClick={() => handleResumeTraining(char.id)}
                                        >
                                            {restartingId === char.id
                                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                                : <RefreshCw className="w-4 h-4 ml-2" />
                                            }
                                            התחל אימון (50 קרדיטים)
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <CreateCharacterModal
                open={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                onCreated={() => { setIsCreateOpen(false); fetchCharacters(); }}
            />
            {deleteId && (
                <DeleteCharacterModal
                    isOpen={!!deleteId}
                    onClose={() => setDeleteId(null)}
                    onConfirm={async () => { await handleDelete(); setDeleteId(null); }}
                />
            )}
        </div>
    );
}