"use client";

import { useState } from "react";
import { Download, Trash2, X, ChevronRight, ChevronLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";
import { toast } from "sonner";
import type { Generation } from "@/types/database";

export function GalleryClient({ generations }: { generations: Generation[] }) {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [filter, setFilter] = useState<string>("all");

    const filteredGenerations = generations.filter((gen) => {
        if (filter === "all") return true;
        return gen.type === filter;
    });

    const selectedGen = selectedIndex !== null ? filteredGenerations[selectedIndex] : null;

    const handleDownload = async (url: string, index: number) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = `generation-${index + 1}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
            toast.success("!הקובץ הורד");
        } catch {
            toast.error("שגיאה בהורדה");
        }
    };

    const goNext = () => {
        if (selectedIndex !== null && selectedIndex < filteredGenerations.length - 1) {
            setSelectedIndex(selectedIndex + 1);
        }
    };

    const goPrev = () => {
        if (selectedIndex !== null && selectedIndex > 0) {
            setSelectedIndex(selectedIndex - 1);
        }
    };

    return (
        <>
            {/* Filters */}
            <div className="flex gap-2 mb-6">
                {["all", "image", "reel", "carousel"].map((f) => (
                    <Button
                        key={f}
                        variant={filter === f ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilter(f)}
                    >
                        {f === "all" && "הכל"}
                        {f === "image" && "תמונות"}
                        {f === "reel" && "ריילים"}
                        {f === "carousel" && "קרוסלות"}
                    </Button>
                ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredGenerations.map((gen, index) => (
                    <Card
                        key={gen.id}
                        className="overflow-hidden group cursor-pointer"
                        onClick={() => setSelectedIndex(index)}
                    >
                        <div className="aspect-square relative">
                            <img
                                src={gen.thumbnail_url || gen.result_urls?.[0]}
                                alt={gen.prompt || "Generated"}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <Button
                                    size="icon"
                                    variant="secondary"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownload(gen.result_urls?.[0] || "", index);
                                    }}
                                >
                                    <Download className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="absolute top-2 right-2">
                                <Badge variant="secondary" className="text-xs">
                                    {gen.type === "image" && "תמונה"}
                                    {gen.type === "reel" && `ריל (${gen.result_urls?.length || 0})`}
                                    {gen.type === "carousel" && "קרוסלה"}
                                </Badge>
                            </div>
                        </div>
                        <CardContent className="p-3">
                            <p className="text-sm text-gray-600 line-clamp-1">
                                {gen.prompt || gen.source_url || "ללא תיאור"}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                                {formatRelativeTime(gen.created_at)}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Lightbox */}
            {selectedGen && (
                <div
                    className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
                    onClick={() => setSelectedIndex(null)}
                >
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-4 right-4 text-white hover:bg-white/10"
                        onClick={() => setSelectedIndex(null)}
                    >
                        <X className="h-6 w-6" />
                    </Button>

                    {/* Navigation */}
                    {selectedIndex! > 0 && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10"
                            onClick={(e) => {
                                e.stopPropagation();
                                goPrev();
                            }}
                        >
                            <ChevronRight className="h-8 w-8" />
                        </Button>
                    )}

                    {selectedIndex! < filteredGenerations.length - 1 && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10"
                            onClick={(e) => {
                                e.stopPropagation();
                                goNext();
                            }}
                        >
                            <ChevronLeft className="h-8 w-8" />
                        </Button>
                    )}

                    {/* Content */}
                    <div
                        className="max-w-4xl max-h-[90vh] overflow-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {selectedGen.result_urls && selectedGen.result_urls.length > 1 ? (
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                {selectedGen.result_urls.map((url, i) => (
                                    <div key={i} className="relative group">
                                        <img
                                            src={url}
                                            alt={`Frame ${i + 1}`}
                                            className="w-full rounded-lg"
                                        />
                                        <Button
                                            size="icon"
                                            variant="secondary"
                                            className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => handleDownload(url, i)}
                                        >
                                            <Download className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <img
                                src={selectedGen.result_urls?.[0]}
                                alt={selectedGen.prompt || "Generated"}
                                className="max-h-[80vh] rounded-lg mx-auto"
                            />
                        )}

                        <div className="mt-4 text-center">
                            <p className="text-white/80">
                                {selectedGen.prompt || selectedGen.source_url || ""}
                            </p>
                            <p className="text-white/50 text-sm mt-1">
                                {formatRelativeTime(selectedGen.created_at)}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}