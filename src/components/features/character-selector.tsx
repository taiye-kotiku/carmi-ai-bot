"use client";

import { useEffect, useState } from "react";
import { Plus, Check, User } from "lucide-react";
import type { Character } from "@/types/database";

interface Props {
    selectedId?: string | null;
    onSelect: (character: Character | null) => void;
    onCreateNew?: () => void;
}

export function CharacterSelector({ selectedId, onSelect, onCreateNew }: Props) {
    const [characters, setCharacters] = useState<Character[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch("/api/characters");
                const data = await res.json();
                const readyCharacters = (data.characters || []).filter(
                    (c: any) => c.status === "ready"
                );
                setCharacters(readyCharacters);
            } catch (err) {
                console.error("Failed to load characters:", err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    if (loading) {
        return (
            <div className="flex gap-3 overflow-x-auto pb-2">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="w-24 h-32 rounded-xl bg-gray-100 animate-pulse flex-shrink-0" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium">בחר דמות</label>
                {onCreateNew && (
                    <button
                        onClick={onCreateNew}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                        <Plus className="w-3 h-3" />
                        דמות חדשה
                    </button>
                )}
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {onCreateNew && (
                    <button
                        onClick={onCreateNew}
                        className="w-24 h-32 rounded-xl border-2 border-dashed border-gray-200 hover:border-primary/50 flex flex-col items-center justify-center gap-2 group transition-colors flex-shrink-0"
                    >
                        <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                            <Plus className="w-4 h-4 text-gray-400 group-hover:text-primary" />
                        </div>
                        <span className="text-xs text-gray-500 group-hover:text-primary font-medium">חדש</span>
                    </button>
                )}

                {characters.map((character) => {
                    const isSelected = selectedId === character.id;
                    const image = character.thumbnail_url || character.reference_images[0];

                    return (
                        <button
                            key={character.id}
                            onClick={() => onSelect(character)}
                            className={`relative w-24 h-32 rounded-xl border-2 transition-all flex-shrink-0 overflow-hidden ${isSelected
                                ? "border-primary shadow-md ring-2 ring-primary/10"
                                : "border-gray-100 hover:border-primary/30"
                                }`}
                        >
                            {image ? (
                                <img
                                    src={image}
                                    alt={character.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-gray-50 flex items-center justify-center">
                                    <User className="w-8 h-8 text-gray-200" />
                                </div>
                            )}

                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2">
                                <p className="text-[10px] text-white font-medium truncate text-center">
                                    {character.name}
                                </p>
                            </div>

                            {isSelected && (
                                <div className="absolute top-1 left-1 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center shadow-sm">
                                    <Check className="w-3 h-3" />
                                </div>
                            )}
                        </button>
                    );
                })}

                {!loading && characters.length === 0 && !onCreateNew && (
                    <p className="text-xs text-gray-400 py-4 w-full text-center italic">
                        אין דמויות מוכנות. צור אחת קודם.
                    </p>
                )}
            </div>
        </div>
    );
}