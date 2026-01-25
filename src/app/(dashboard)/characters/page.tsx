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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CreateCharacterModal } from "@/components/features/create-character-modal";
import { EditCharacterModal } from "@/components/features/edit-character-modal";
import { DeleteCharacterModal } from "@/components/features/delete-character-modal";
import { Character } from "@/types/database";
import { toast } from "sonner";
import Link from "next/link";

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

    // Close menu when clicking outside
    useEffect(() => {
        const handleClick = () => setOpenMenuId(null);
        if (openMenuId) {
            document.addEventListener("click", handleClick);
            return () => document.removeEventListener("click", handleClick);
        }
    }, [openMenuId]);

    function formatDate(dateString: string) {
        return new Date(dateString).toLocaleDateString("he-IL", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    }

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
                            className="group overflow-hidden hover:shadow-lg transition-shadow"
                        >
                            {/* Character Image */}
                            <div className="relative aspect-square bg-gray-100">
                                <img
                                    src={character.thumbnail_url || character.reference_images[0]}
                                    alt={character.name}
                                    className="w-full h-full object-cover"
                                />

                                {/* Overlay with reference count */}
                                <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1 flex items-center gap-1">
                                    <ImageIcon className="h-3 w-3 text-white" />
                                    <span className="text-xs text-white">
                                        {character.reference_images.length}
                                    </span>
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
                                    <Link href={`/generate/character?id=${character.id}`}>
                                        <Button size="sm" variant="outline">
                                            <Sparkles className="h-3 w-3 ml-1" />
                                            יצירה
                                        </Button>
                                    </Link>
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

            {/* Reference Images Preview (when characters exist) */}
            {!loading && characters.length > 0 && (
                <div className="mt-12">
                    <h2 className="text-lg font-semibold mb-4">איך זה עובד?</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white rounded-xl p-4 border">
                            <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                                <span className="text-lg font-bold text-purple-600">1</span>
                            </div>
                            <h3 className="font-medium mb-1">העלה תמונות ייחוס</h3>
                            <p className="text-sm text-gray-500">
                                העלה 1-4 תמונות ברורות של הפנים מזוויות שונות
                            </p>
                        </div>
                        <div className="bg-white rounded-xl p-4 border">
                            <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                                <span className="text-lg font-bold text-purple-600">2</span>
                            </div>
                            <h3 className="font-medium mb-1">תאר את הסצנה</h3>
                            <p className="text-sm text-gray-500">
                                כתוב מה הדמות עושה, איפה היא נמצאת, ומה האווירה
                            </p>
                        </div>
                        <div className="bg-white rounded-xl p-4 border">
                            <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                                <span className="text-lg font-bold text-purple-600">3</span>
                            </div>
                            <h3 className="font-medium mb-1">קבל תמונות עקביות</h3>
                            <p className="text-sm text-gray-500">
                                הבינה המלאכותית תיצור תמונות עם אותה דמות בדיוק
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