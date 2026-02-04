"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Loader2, Upload, Play, Image as ImageIcon, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Character {
    id: string;
    name: string;
    description?: string;
    image_urls: string[];
    status: "draft" | "pending" | "training" | "ready" | "failed";
    trigger_word?: string;
    lora_url?: string;
    error_message?: string;
    created_at: string;
}

export default function CharactersPage() {
    const [characters, setCharacters] = useState<Character[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState("");
    const [showCreate, setShowCreate] = useState(false);
    const [uploading, setUploading] = useState<string | null>(null);
    const [training, setTraining] = useState<string | null>(null);

    useEffect(() => {
        fetchCharacters();
    }, []);

    // Poll for training status
    useEffect(() => {
        const trainingChars = characters.filter(c => c.status === "training");
        if (trainingChars.length === 0) return;

        const interval = setInterval(async () => {
            for (const char of trainingChars) {
                try {
                    const res = await fetch(`/api/characters/${char.id}/train/status`);
                    const data = await res.json();

                    if (data.status === "ready" || data.status === "failed") {
                        fetchCharacters();
                        if (data.status === "ready") {
                            toast.success(`${char.name} מוכן לשימוש!`);
                        } else {
                            toast.error(`האימון של ${char.name} נכשל`);
                        }
                    }
                } catch (e) {
                    console.error("Status check error:", e);
                }
            }
        }, 10000);

        return () => clearInterval(interval);
    }, [characters]);

    async function fetchCharacters() {
        try {
            const res = await fetch("/api/characters");
            const data = await res.json();
            setCharacters(data);
        } catch (error) {
            toast.error("שגיאה בטעינת דמויות");
        } finally {
            setLoading(false);
        }
    }

    async function createCharacter() {
        if (!newName.trim()) {
            toast.error("יש להזין שם לדמות");
            return;
        }

        setCreating(true);
        try {
            const res = await fetch("/api/characters", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName }),
            });

            if (!res.ok) throw new Error("Failed to create");

            const newChar = await res.json();
            setCharacters([newChar, ...characters]);
            setNewName("");
            setShowCreate(false);
            toast.success("הדמות נוצרה בהצלחה");
        } catch (error) {
            toast.error("שגיאה ביצירת הדמות");
        } finally {
            setCreating(false);
        }
    }

    async function deleteCharacter(id: string) {
        if (!confirm("למחוק את הדמות?")) return;

        try {
            await fetch(`/api/characters/${id}`, { method: "DELETE" });
            setCharacters(characters.filter(c => c.id !== id));
            toast.success("הדמות נמחקה");
        } catch (error) {
            toast.error("שגיאה במחיקה");
        }
    }

    async function uploadImages(characterId: string, files: FileList) {
        setUploading(characterId);
        const urls: string[] = [];

        try {
            for (const file of Array.from(files)) {
                const formData = new FormData();
                formData.append("file", file);

                const res = await fetch("/api/upload", {
                    method: "POST",
                    body: formData,
                });

                if (!res.ok) throw new Error("Upload failed");

                const data = await res.json();
                urls.push(data.url);
            }

            // Update character with new images
            const char = characters.find(c => c.id === characterId);
            const allUrls = [...(char?.image_urls || []), ...urls];

            await fetch(`/api/characters/${characterId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image_urls: allUrls }),
            });

            fetchCharacters();
            toast.success(`${urls.length} תמונות הועלו`);
        } catch (error) {
            toast.error("שגיאה בהעלאה");
        } finally {
            setUploading(null);
        }
    }

    async function startTraining(characterId: string) {
        setTraining(characterId);
        try {
            const res = await fetch(`/api/characters/${characterId}/train`, {
                method: "POST",
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Training failed");
            }

            toast.success("האימון התחיל! זה יכול לקחת 10-20 דקות");
            fetchCharacters();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setTraining(null);
        }
    }

    function getStatusBadge(status: string) {
        switch (status) {
            case "ready":
                return <span className="flex items-center gap-1 text-green-600"><CheckCircle size={14} /> מוכן</span>;
            case "training":
                return <span className="flex items-center gap-1 text-yellow-600"><Loader2 size={14} className="animate-spin" /> מאמן...</span>;
            case "failed":
                return <span className="flex items-center gap-1 text-red-600"><AlertCircle size={14} /> נכשל</span>;
            default:
                return <span className="flex items-center gap-1 text-gray-500"><Clock size={14} /> טיוטה</span>;
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6" dir="rtl">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">הדמויות שלי</h1>
                <Button onClick={() => setShowCreate(true)}>
                    <Plus className="w-4 h-4 ml-2" />
                    דמות חדשה
                </Button>
            </div>

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">יצירת דמות חדשה</h2>
                        <Input
                            placeholder="שם הדמות"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="mb-4"
                        />
                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={() => setShowCreate(false)}>
                                ביטול
                            </Button>
                            <Button onClick={createCharacter} disabled={creating}>
                                {creating && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                                יצירה
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Characters Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {characters.map((char) => (
                    <Card key={char.id} className="p-4">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h3 className="font-bold text-lg">{char.name}</h3>
                                <div className="text-sm mt-1">{getStatusBadge(char.status)}</div>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteCharacter(char.id)}
                            >
                                <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                        </div>

                        {/* Images Preview */}
                        <div className="grid grid-cols-4 gap-2 mb-4">
                            {char.image_urls?.slice(0, 4).map((url, i) => (
                                <img
                                    key={i}
                                    src={url}
                                    alt=""
                                    className="w-full aspect-square object-cover rounded"
                                />
                            ))}
                            {(!char.image_urls || char.image_urls.length === 0) && (
                                <div className="col-span-4 bg-gray-100 rounded p-4 text-center text-gray-500 text-sm">
                                    אין תמונות
                                </div>
                            )}
                        </div>

                        <div className="text-sm text-gray-500 mb-3">
                            {char.image_urls?.length || 0} תמונות
                            {char.trigger_word && ` • ${char.trigger_word}`}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 flex-wrap">
                            {/* Upload Images */}
                            <label className="cursor-pointer">
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => e.target.files && uploadImages(char.id, e.target.files)}
                                    disabled={uploading === char.id}
                                />
                                <Button variant="outline" size="sm" asChild disabled={uploading === char.id}>
                                    <span>
                                        {uploading === char.id ? (
                                            <Loader2 className="w-4 h-4 ml-1 animate-spin" />
                                        ) : (
                                            <Upload className="w-4 h-4 ml-1" />
                                        )}
                                        העלאת תמונות
                                    </span>
                                </Button>
                            </label>

                            {/* Train Button */}
                            {char.status !== "ready" && char.status !== "training" && (
                                <Button
                                    size="sm"
                                    onClick={() => startTraining(char.id)}
                                    disabled={training === char.id || (char.image_urls?.length || 0) < 3}
                                >
                                    {training === char.id ? (
                                        <Loader2 className="w-4 h-4 ml-1 animate-spin" />
                                    ) : (
                                        <Play className="w-4 h-4 ml-1" />
                                    )}
                                    התחל אימון
                                </Button>
                            )}

                            {/* Generate Buttons (only for ready characters) */}
                            {char.status === "ready" && (
                                <>
                                    <Button size="sm" variant="outline" asChild>
                                        <a href={`/generate/character?id=${char.id}`}>
                                            <ImageIcon className="w-4 h-4 ml-1" />
                                            יצירת תמונה
                                        </a>
                                    </Button>
                                    <Button size="sm" variant="outline" asChild>
                                        <a href={`/generate/character-video?id=${char.id}`}>
                                            <Play className="w-4 h-4 ml-1" />
                                            יצירת סרטון
                                        </a>
                                    </Button>
                                </>
                            )}
                        </div>

                        {/* Error Message */}
                        {char.status === "failed" && char.error_message && (
                            <div className="mt-3 text-sm text-red-600 bg-red-50 p-2 rounded">
                                {char.error_message}
                            </div>
                        )}
                    </Card>
                ))}
            </div>

            {characters.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                    <p className="mb-4">אין לך דמויות עדיין</p>
                    <Button onClick={() => setShowCreate(true)}>
                        <Plus className="w-4 h-4 ml-2" />
                        יצירת דמות ראשונה
                    </Button>
                </div>
            )}
        </div>
    );
}