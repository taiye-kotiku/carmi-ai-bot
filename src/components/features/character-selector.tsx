// src/components/features/character-selector.tsx
"use client";

import type { Character } from "@/types/database";

interface Props {
    characters: Character[];
    selected: Character | null;
    onSelect: (character: Character) => void;
}

export function CharacterSelector({ characters, selected, onSelect }: Props) {
    if (characters.length === 0) {
        return (
            <p className="text-sm text-muted-foreground py-4 text-center">
                אין דמויות זמינות ליצירה
            </p>
        );
    }

    return (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {characters.map((character) => (
                <button
                    key={character.id}
                    onClick={() => onSelect(character)}
                    className={`relative rounded-xl overflow-hidden border-2 transition-all ${selected?.id === character.id
                            ? "border-primary shadow-lg ring-2 ring-primary/20"
                            : "border-border hover:border-primary/50"
                        }`}
                >
                    <div className="aspect-square bg-muted">
                        {(character.thumbnail_url || character.reference_images[0]) && (
                            <img
                                src={character.thumbnail_url || character.reference_images[0]}
                                alt={character.name}
                                className="w-full h-full object-cover"
                            />
                        )}
                    </div>
                    <div className="p-2">
                        <p className="text-sm font-medium truncate text-center">
                            {character.name}
                        </p>
                    </div>
                    {selected?.id === character.id && (
                        <div className="absolute top-2 left-2 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">
                            ✓
                        </div>
                    )}
                </button>
            ))}
        </div>
    );
}