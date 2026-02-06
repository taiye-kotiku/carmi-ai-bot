// src/app/(dashboard)/characters/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Users,
    Plus,
    MoreVertical,
    Pencil,
    Trash2,
    Loader2,
    ImageIcon,
    Calendar,
    Sparkles,
    CheckCircle2,
    AlertCircle,
    Clock,
    RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CreateCharacterModal } from "@/components/features/create-character-modal";
import { EditCharacterModal } from "@/components/features/edit-character-modal";
import { DeleteCharacterModal } from "@/components/features/delete-character-modal";
import { Character } from "@/types/database";
import { toast } from "sonner";
import Link from "next/link";

// Status badge component
function StatusBadge({ status }: { status: string }) {
    switch (status) {
        case "training":
            return (
                <div className="flex items-center gap-1.5 bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    מאמן...
                </div>
            );
        case "ready":
            return (
                <div className="flex items-center gap-1.5 bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">
                    <CheckCircle2 className="h-3 w-3" />
                    מוכן
                </div>
            );
        case "failed":
            return (
                <div className="flex items-center gap-1.5 bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-medium">
                    <AlertCircle className="h-3 w-3" />
                    נכשל
                </div>
            );
        default:
            return (
                <div className="flex items-center gap-1.5 bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs font-medium">
                    <Clock className="h-3 w-3" />
                    טיוטה
                </div>
            );
    }
}

export default function CharactersPage() {
    const [characters, setCharacters] = useState<Character[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
    const [deletingCharacter, setDeletingCharacter] = useState<Character | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    const fetchCharacters = useCallback(async () => {
        try {
            const res = await fetch("/api/characters");
            if (res.ok) {
                const data = await res.json();
                setCharacters(data);
            }
        } catch (err) {
            console.error("Failed to fetch characters:", err);
            toast.error("שגיאה בטעינת הדמויות");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCharacters();
    }, [fetchCharacters]);

    // Auto-refresh when there are training characters
    useEffect(() => {
        const hasTraining = characters.some((c) => c.model_status === "training");
        if (hasTraining) {
            const interval = setInterval(fetchCharacters, 15000); // Check every 15 seconds
            return () => clearInterval(interval);
        }
    }, [characters, fetchCharacters]);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClick = () => setOpenMenuId(null);
        if (openMenuId) {
            document.addEventListener("click", handleClick);
            return () => document.removeEventListener("click", handleClick);
        }
    }, [openMenuId]);

    // Manual retry training
    async function retryTraining(characterId: string) {
        try {
            const res = await fetch(`/api/characters/${characterId}/train`, {
                method: "POST",
            });
            if (res.ok) {
                toast.success("האימון התחיל מחדש!");
                fetchCharacters();
            } else {
                throw new Error("Failed to start training");
            }
        } catch (err) {
            toast.error("שגיאה בהפעלת האימון");
        }
    }

    function formatDate(dateString: string) {
        return new Date(dateString).toLocaleDateString("he-IL", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    }

    const trainingCount = characters.filter((c) => c.model_status === "training").length;

    return (
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="h-12 w-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                        <Users className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">הדמויות שלי</h1>
                        <p className="text-gray-600">
                            נהל את הדמויות שלך ליצירת תמונות עקביות
                        </p>
                    </div>
                </div>
                <Button onClick={() => setShowCreateModal(true)}>
                    <Plus className="h-4 w-4 ml-2" />
                    דמות חדשה
                </Button>
            </div>

            {/* Training Progress Banner */}
            {trainingCount > 0 && (
                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
                    <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                    <div className="flex-1">
                        <p className="font-medium text-blue-900">
                            {trainingCount} {trainingCount === 1 ? "דמות באימון" : "דמויות באימון"}
                        </p>
                        <p className="text-sm text-blue-700">
                            האימון לוקח כ-15-20 דקות. הדף יתעדכן אוטומטית.
                        </p>
                    </div>
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                </div>
            )}

            {/* Empty State */}
            {!loading && characters.length === 0 && (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <div className="h-20 w-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <Users className="h-10 w-10 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            אין לך דמויות עדיין
                        </h3>
                        <p className="text-gray-500 text-center mb-6 max-w-sm">
                            צור דמות חדשה כדי ליצור תמונות עקביות של אותו אדם בסצנות שונות
                        </p>
                        <Button onClick={() => setShowCreateModal(true)}>
                            <Plus className="h-4 w-4 ml-2" />
                            צור דמות ראשונה
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Characters Grid */}
            {!loading && characters.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {characters.map((character) => (
                        <Card
                            key={character.id}
                            className={`group overflow-hidden hover:shadow-lg transition-shadow ${character.model_status === "training" ? "ring-2 ring-blue-300" : ""
                                }`}
                        >
                            {/* Character Image */}
                            <div className="relative aspect-square bg-gray-100">
                                <img
                                    src={character.thumbnail_url || character.reference_images?.[0] || (character as any).image_urls?.[0] || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect fill='%23e5e7eb' width='400' height='400'/%3E%3C/svg%3E"}
                                    alt={character.name}
                                    className={`w-full h-full object-cover ${character.model_status === "training" ? "opacity-75" : ""
                                        }`}
                                />

                                {/* Training Overlay */}
                                {character.model_status === "training" && (
                                    <div className="absolute inset-0 bg-blue-900/20 flex items-center justify-center">
                                        <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 text-center">
                                            <Loader2 className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-2" />
                                            <p className="text-sm font-medium">מאמן AI...</p>
                                            <p className="text-xs text-gray-500">~15 דקות</p>
                                        </div>
                                    </div>
                                )}

                                {/* Overlay with reference count */}
                                <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1 flex items-center gap-1">
                                    <ImageIcon className="h-3 w-3 text-white" />
                                    <span className="text-xs text-white">
                                        {character.reference_images?.length ?? (character as any).image_urls?.length ?? 0}
                                    </span>
                                </div>

                                {/* Status Badge */}
                                <div className="absolute top-2 right-2">
                                    <StatusBadge status={character.model_status || "draft"} />
                                </div>

                                {/* Menu Button */}
                                <div className="absolute top-2 left-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenMenuId(
                                                openMenuId === character.id ? null : character.id
                                            );
                                        }}
                                        className="p-1.5 bg-white/90 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                                    >
                                        <MoreVertical className="h-4 w-4 text-gray-600" />
                                    </button>

                                    {/* Dropdown Menu */}
                                    {openMenuId === character.id && (
                                        <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border py-1 min-w-[140px] z-10">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingCharacter(character);
                                                    setOpenMenuId(null);
                                                }}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                                            >
                                                <Pencil className="h-4 w-4" />
                                                עריכה
                                            </button>
                                            {character.model_status === "failed" && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        retryTraining(character.id);
                                                        setOpenMenuId(null);
                                                    }}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50"
                                                >
                                                    <RotateCw className="h-4 w-4" />
                                                    נסה שוב
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDeletingCharacter(character);
                                                    setOpenMenuId(null);
                                                }}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                מחיקה
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Character Info */}
                            <CardContent className="p-4">
                                <h3 className="font-semibold text-lg mb-1">
                                    {character.name}
                                </h3>
                                {character.description && (
                                    <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                                        {character.description}
                                    </p>
                                )}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1 text-xs text-gray-400">
                                        <Calendar className="h-3 w-3" />
                                        {formatDate(character.created_at)}
                                    </div>
                                    {character.model_status === "ready" ? (
                                        <Link href={`/generate/character?id=${character.id}`}>
                                            <Button size="sm" variant="default">
                                                <Sparkles className="h-3 w-3 ml-1" />
                                                יצירה
                                            </Button>
                                        </Link>
                                    ) : character.model_status === "training" ? (
                                        <Button size="sm" variant="outline" disabled>
                                            <Loader2 className="h-3 w-3 ml-1 animate-spin" />
                                            מאמן...
                                        </Button>
                                    ) : character.model_status === "failed" ? (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => retryTraining(character.id)}
                                        >
                                            <RotateCw className="h-3 w-3 ml-1" />
                                            נסה שוב
                                        </Button>
                                    ) : (character.model_status === "pending" || character.model_status === "draft") &&
                                      (character.reference_images?.length ?? (character as any).image_urls?.length ?? 0) >= 15 ? (
                                        <Button
                                            size="sm"
                                            variant="default"
                                            onClick={() => retryTraining(character.id)}
                                        >
                                            <Sparkles className="h-3 w-3 ml-1" />
                                            התחל אימון
                                        </Button>
                                    ) : (
                                        <Link href={`/generate/character?id=${character.id}`}>
                                            <Button size="sm" variant="outline">
                                                <Sparkles className="h-3 w-3 ml-1" />
                                                יצירה
                                            </Button>
                                        </Link>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {/* Add New Card */}
                    <Card
                        className="border-2 border-dashed hover:border-purple-300 hover:bg-purple-50/50 transition-colors cursor-pointer"
                        onClick={() => setShowCreateModal(true)}
                    >
                        <CardContent className="flex flex-col items-center justify-center h-full min-h-[300px]">
                            <div className="h-16 w-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                                <Plus className="h-8 w-8 text-purple-600" />
                            </div>
                            <p className="font-medium text-gray-700">הוסף דמות חדשה</p>
                            <p className="text-sm text-gray-500">העלה תמונות ייחוס</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* How it works section */}
            {!loading && characters.length > 0 && (
                <div className="mt-12">
                    <h2 className="text-lg font-semibold mb-4">איך זה עובד?</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white rounded-xl p-4 border">
                            <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                                <span className="text-lg font-bold text-purple-600">1</span>
                            </div>
                            <h3 className="font-medium mb-1">העלה 3+ תמונות</h3>
                            <p className="text-sm text-gray-500">
                                העלה תמונות ברורות של הפנים מזוויות שונות לאימון AI
                            </p>
                        </div>
                        <div className="bg-white rounded-xl p-4 border">
                            <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                                <span className="text-lg font-bold text-purple-600">2</span>
                            </div>
                            <h3 className="font-medium mb-1">המתן לאימון</h3>
                            <p className="text-sm text-gray-500">
                                ה-AI לומד את הפנים תוך ~15 דקות. תקבל התראה כשיסתיים
                            </p>
                        </div>
                        <div className="bg-white rounded-xl p-4 border">
                            <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                                <span className="text-lg font-bold text-purple-600">3</span>
                            </div>
                            <h3 className="font-medium mb-1">צור תמונות מדהימות</h3>
                            <p className="text-sm text-gray-500">
                                תאר סצנה וקבל תמונות של הדמות שלך בכל מצב שתרצה
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals */}
            <CreateCharacterModal
                open={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onCreated={fetchCharacters}
            />

            {editingCharacter && (
                <EditCharacterModal
                    character={editingCharacter}
                    onClose={() => setEditingCharacter(null)}
                    onUpdated={fetchCharacters}
                />
            )}

            {deletingCharacter && (
                <DeleteCharacterModal
                    character={deletingCharacter}
                    onClose={() => setDeletingCharacter(null)}
                    onDeleted={fetchCharacters}
                />
            )}
        </div>
    );
}