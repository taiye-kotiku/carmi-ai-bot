"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, X, ChevronRight, ChevronLeft, Play, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";
import { toast } from "sonner";
import type { Tables } from "@/types/database";

type Generation = Tables<"generations">;

function isVideoUrl(url: string): boolean {
    if (!url) return false;
    const videoExtensions = [".mp4", ".webm", ".mov", ".avi"];
    const lowerUrl = url.toLowerCase();
    return videoExtensions.some((ext) => lowerUrl.includes(ext));
}

export function GalleryClient({ generations }: { generations: Generation[] }) {
    const router = useRouter();
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [filter, setFilter] = useState<string>("all");
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleDelete = async (e: React.MouseEvent, gen: Generation) => {
        e.stopPropagation();
        if (gen.files_deleted) return;
        if (deletingId) return;
        setDeletingId(gen.id);
        try {
            const res = await fetch(`/api/generations/${gen.id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "שגיאה");
            toast.success("התוכן נמחק");
            router.refresh();
        } catch (err: any) {
            toast.error(err.message || "שגיאה במחיקה");
        } finally {
            setDeletingId(null);
        }
    };

    const filteredGenerations = generations.filter((gen) => {
        if (filter === "all") return true;
        if (filter === "video") {
            return gen.type === "video" || gen.feature === "video_clips" || gen.feature === "text_to_video";
        }
        return gen.type === filter;
    });

    const selectedGen = selectedIndex !== null ? filteredGenerations[selectedIndex] : null;

    const handleDownload = async (url: string, index: number, isVideo = false) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = `generation-${index + 1}.${isVideo ? "mp4" : "jpg"}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
            toast.success("הקובץ הורד!");
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

    const getTypeBadge = (gen: Generation) => {
        if (gen.feature === "video_clips") return "קליפים";
        if (gen.feature === "text_to_video") return "וידאו AI";
        if (gen.type === "video") return "וידאו";
        if (gen.type === "image") return "תמונה";
        if (gen.type === "reel") return `רילז (${gen.result_urls?.length || 0})`;
        if (gen.type === "carousel") return "קרוסלה";
        return gen.type;
    };

    const hasVideo = (gen: Generation) => {
        return (
            gen.type === "video" ||
            gen.feature === "video_clips" ||
            gen.feature === "text_to_video" ||
            isVideoUrl(gen.result_urls?.[0] || "")
        );
    };

    const isDeleted = (gen: Generation) => {
        return gen.files_deleted === true;
    };

    return (
        <>
            {/* Filters */}
            <div className="flex gap-2 mb-6 flex-wrap">
                {["all", "image", "video", "reel", "carousel"].map((f) => (
                    <Button
                        key={f}
                        variant={filter === f ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilter(f)}
                    >
                        {f === "all" && "הכל"}
                        {f === "image" && "תמונות"}
                        {f === "video" && "וידאו"}
                        {f === "reel" && "רילז"}
                        {f === "carousel" && "קרוסלות"}
                    </Button>
                ))}
            </div>

            {filteredGenerations.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                    <p>אין תוצאות להצגה</p>
                </div>
            )}

            {/* Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredGenerations.map((gen, index) => {
                    const deleted = isDeleted(gen);
                    const isVideo = hasVideo(gen);
                    const thumbnailUrl = gen.thumbnail_url || gen.result_urls?.[0];

                    return (
                        <Card
                            key={gen.id}
                            className={`overflow-hidden group ${deleted ? "opacity-60" : "cursor-pointer"}`}
                            onClick={() => !deleted && setSelectedIndex(index)}
                        >
                            <div className="aspect-square relative bg-gray-100">
                                {deleted ? (
                                    /* Files deleted placeholder */
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 p-4">
                                        <Trash2 className="h-8 w-8 text-gray-300 mb-2" />
                                        <p className="text-xs text-gray-400 text-center leading-relaxed">
                                            הקבצים נמחקו
                                            <br />
                                            לפינוי אחסון
                                        </p>
                                    </div>
                                ) : isVideo ? (
                                    <>
                                        {thumbnailUrl && !isVideoUrl(thumbnailUrl) ? (
                                            <img
                                                src={thumbnailUrl}
                                                alt={gen.prompt || "Generated"}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <video
                                                src={gen.result_urls?.[0]}
                                                className="w-full h-full object-cover"
                                                muted
                                                playsInline
                                                onMouseEnter={(e) => e.currentTarget.play()}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.pause();
                                                    e.currentTarget.currentTime = 0;
                                                }}
                                            />
                                        )}
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <div className="bg-black/50 rounded-full p-3">
                                                <Play className="h-8 w-8 text-white fill-white" />
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <img
                                        src={thumbnailUrl}
                                        alt={gen.prompt || "Generated"}
                                        className="w-full h-full object-cover"
                                    />
                                )}

                                {/* Hover overlay — only for non-deleted */}
                                {!deleted && (
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <Button
                                            size="icon"
                                            variant="secondary"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDownload(gen.result_urls?.[0] || "", index, isVideo);
                                            }}
                                        >
                                            <Download className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="destructive"
                                            onClick={(e) => handleDelete(e, gen)}
                                            disabled={deletingId === gen.id}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}

                                {/* Type badge */}
                                <div className="absolute top-2 right-2">
                                    <Badge variant="secondary" className="text-xs">
                                        {getTypeBadge(gen)}
                                    </Badge>
                                </div>

                                {/* Deleted badge */}
                                {deleted && (
                                    <div className="absolute top-2 left-2">
                                        <Badge variant="outline" className="text-xs bg-white/90 text-gray-500 border-gray-300">
                                            נמחק
                                        </Badge>
                                    </div>
                                )}

                                {/* Clip count */}
                                {!deleted && gen.feature === "video_clips" && gen.result_urls && gen.result_urls.length > 1 && (
                                    <div className="absolute bottom-2 left-2">
                                        <Badge className="text-xs bg-purple-600">
                                            {gen.result_urls.length} קליפים
                                        </Badge>
                                    </div>
                                )}
                            </div>
                            <CardContent className="p-3">
                                <p className="text-sm text-gray-600 line-clamp-1">
                                    {gen.prompt || gen.source_url || "ללא תיאור"}
                                </p>
                                <div className="flex items-center justify-between mt-1">
                                    <p className="text-xs text-gray-400">
                                        {formatRelativeTime(gen.created_at)}
                                    </p>
                                    {deleted && (
                                        <p className="text-[10px] text-gray-400">
                                            {gen.file_size_bytes
                                                ? `${Math.round((gen.file_size_bytes || 0) / 1024)}KB שוחרר`
                                                : ""}
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Lightbox — only for non-deleted */}
            {selectedGen && !isDeleted(selectedGen) && (
                <div
                    className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
                    onClick={() => setSelectedIndex(null)}
                >
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-4 right-4 text-white hover:bg-white/10 z-10"
                        onClick={() => setSelectedIndex(null)}
                    >
                        <X className="h-6 w-6" />
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        className="absolute top-4 left-4 z-10 flex items-center gap-1.5"
                        onClick={(e) => {
                            if (selectedGen) {
                                handleDelete(e, selectedGen);
                                setSelectedIndex(null);
                            }
                        }}
                        disabled={deletingId === selectedGen?.id}
                    >
                        <Trash2 className="h-4 w-4" /> מחק
                    </Button>

                    {selectedIndex! > 0 && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10 z-10"
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
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10 z-10"
                            onClick={(e) => {
                                e.stopPropagation();
                                goNext();
                            }}
                        >
                            <ChevronLeft className="h-8 w-8" />
                        </Button>
                    )}

                    <div
                        className="max-w-5xl max-h-[90vh] overflow-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {hasVideo(selectedGen) ? (
                            selectedGen.result_urls && selectedGen.result_urls.length > 1 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {selectedGen.result_urls.map((url, i) => (
                                        <div key={i} className="relative group">
                                            <video
                                                src={url}
                                                controls
                                                className="w-full rounded-lg"
                                            />
                                            <Button
                                                size="icon"
                                                variant="secondary"
                                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => handleDownload(url, i, true)}
                                            >
                                                <Download className="h-4 w-4" />
                                            </Button>
                                            <p className="text-white/70 text-sm mt-2 text-center">
                                                קליפ {i + 1}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <video
                                    src={selectedGen.result_urls?.[0]}
                                    controls
                                    autoPlay
                                    className="max-h-[70vh] rounded-lg mx-auto"
                                />
                            )
                        ) : selectedGen.result_urls && selectedGen.result_urls.length > 1 ? (
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