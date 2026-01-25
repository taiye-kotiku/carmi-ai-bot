// src/components/features/character-selector.tsx
"use client";

import { useState, useEffect } from "react";
import { Plus, Check, User } from "lucide-react";
import { Character } from "@/types/database";

interface CharacterSelectorProps {
    selectedId?: string;
    onSelect: (character: Character | null) => void;
    onCreateNew: () => void;
}

export function CharacterSelector({
    selectedId,
    onSelect,
    onCreateNew,
}: CharacterSelectorProps) {
    const [characters, setCharacters] = useState<Character[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCharacters();
    }, []);

    async function fetchCharacters() {
        try {
            const res = await fetch("/api/characters");
            if (res.ok) {
                const data = await res.json();
                setCharacters(data);
            }
        } catch (err) {
            console.error("Failed to fetch characters:", err);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="flex gap-3 overflow-x-auto pb-2">
                {[1, 2, 3].map((i) => (
                    <div
                        key={i}
                        className="w-20 h-20 rounded-xl bg-gray-100 animate-pulse flex-shrink-0"
                    />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium">דמות (אופציונלי)</label>
            <div className="flex gap-3 overflow-x-auto pb-2">
                {/* No character option */}
                <button
                    onClick={() => onSelect(null)}
                    className={`flex-shrink-0 w-20 h-20 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${!selectedId
                            ? "border-primary bg-primary/5"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                >
                    <User className="w-5 h-5 text-gray-400" />
                    <span className="text-xs text-gray-500">ללא</span>
                </button>

                {/* Characters */}
                {characters.map((char) => (
                    <button
                        key={char.id}
                        onClick={() => onSelect(char)}
                        className={`relative flex-shrink-0 w-20 h-20 rounded-xl border-2 overflow-hidden transition-all ${selectedId === char.id
                                ? "border-primary ring-2 ring-primary/20"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                    >
                        <img
                            src={char.thumbnail_url || char.reference_images[0]}
                            alt={char.name}
                            className="w-full h-full object-cover"
                        />
                        {selectedId === char.id && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                <Check className="w-6 h-6 text-primary" />
                            </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                            <span className="text-[10px] text-white truncate block text-center">
                                {char.name}
                            </span>
                        </div>
                    </button>
                ))}

                {/* Create new */}
                <button
                    onClick={onCreateNew}
                    className="flex-shrink-0 w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 hover:border-primary flex flex-col items-center justify-center gap-1 transition-all"
                >
                    <Plus className="w-5 h-5 text-gray-400" />
                    <span className="text-xs text-gray-500">חדש</span>
                </button>
            </div>
        </div>
    );
}