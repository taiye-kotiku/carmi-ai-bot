"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
    Loader2,
    Download,
    Scissors,
    Upload,
    Link,
    Play,
    Star,
} from "lucide-react";

interface Clip {
    url: string;
    thumbnail: string;
    title: string;
    duration: number;
    startTime: number;
    endTime: number;
    transcript: string;
    viralityScore: number;
}

export default function VideoClipsPage() {
    const [mode, setMode] = useState<"url" | "upload">("url");
    const [videoUrl, setVideoUrl] = useState("");
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9" | "1:1">("9:16");
    const [clipLength, setClipLength] = useState<"short" | "medium" | "long">("short");
    const [maxClips, setMaxClips] = useState(10);

    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [clips, setClips] = useState<Clip[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [playingClip, setPlayingClip] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setVideoFile(file);
        }
    };

    const handleGenerate = async () => {
        if (mode === "url" && !videoUrl.trim()) return;
        if (mode === "upload" && !videoFile) return;

        setIsProcessing(true);
        setProgress(0);
        setError(null);
        setClips(null);

        try {
            let response: Response;

            if (mode === "upload" && videoFile) {
                const formData = new FormData();
                formData.append("video", videoFile);
                formData.append("aspectRatio", aspectRatio);
                formData.append("clipLength", clipLength);
                formData.append("maxClips", maxClips.toString());
                formData.append("language", "he");

                response = await fetch("/api/generate/video-clips", {
                    method: "POST",
                    body: formData,
                });
            } else {
                response = await fetch("/api/generate/video-clips", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        videoUrl,
                        aspectRatio,
                        clipLength,
                        maxClips,
                        language: "he",
                    }),
                });
            }

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "שגיאה בחיתוך הסרטון");
            }

            const { jobId } = await response.json();

            // Poll for job status
            const pollInterval = setInterval(async () => {
                const jobResponse = await fetch(`/api/jobs/${jobId}`);
                const job = await jobResponse.json();

                setProgress(job.progress);

                if (job.status === "completed") {
                    clearInterval(pollInterval);
                    setClips(job.result.clips);
                    setIsProcessing(false);
                } else if (job.status === "failed") {
                    clearInterval(pollInterval);
                    setError(job.error || "שגיאה בחיתוך הסרטון");
                    setIsProcessing(false);
                }
            }, 3000);

        } catch (err: any) {
            setError(err.message);
            setIsProcessing(false);
        }
    };

    const handleDownload = async (clip: Clip, index: number) => {
        const response = await fetch(clip.url);
        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `clip-${index + 1}.mp4`;
        a.click();
        URL.revokeObjectURL(downloadUrl);
    };

    const handleDownloadAll = async () => {
        if (!clips) return;
        for (let i = 0; i < clips.length; i++) {
            await handleDownload(clips[i], i);
            // Small delay between downloads
            await new Promise(r => setTimeout(r, 500));
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const getViralityColor = (score: number) => {
        if (score >= 80) return "bg-green-500";
        if (score >= 60) return "bg-yellow-500";
        return "bg-gray-500";
    };

    return (
        <div className="container mx-auto py-8 px-4" dir="rtl">
            <div className="max-w-5xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                        <Scissors className="h-8 w-8 text-orange-500" />
                        חיתוך סרטון לקליפים
                    </h1>
                    <p className="text-gray-600">
                        העלה סרטון ארוך וה-AI יחתוך אותו לקליפים קצרים וויראליים
                    </p>
                </div>

                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>מקור הסרטון</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Mode Toggle */}
                        <div className="flex gap-2">
                            <Button
                                variant={mode === "url" ? "default" : "outline"}
                                onClick={() => setMode("url")}
                                disabled={isProcessing}
                            >
                                <Link className="h-4 w-4 ml-2" />
                                קישור URL
                            </Button>
                            <Button
                                variant={mode === "upload" ? "default" : "outline"}
                                onClick={() => setMode("upload")}
                                disabled={isProcessing}
                            >
                                <Upload className="h-4 w-4 ml-2" />
                                העלאת קובץ
                            </Button>
                        </div>

                        {/* URL Input */}
                        {mode === "url" && (
                            <Input
                                placeholder="הכנס קישור לסרטון (YouTube, Vimeo, וכו')"
                                value={videoUrl}
                                onChange={(e) => setVideoUrl(e.target.value)}
                                disabled={isProcessing}
                                className="text-right"
                            />
                        )}

                        {/* File Upload */}
                        {mode === "upload" && (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-orange-500 transition-colors"
                            >
                                {videoFile ? (
                                    <div>
                                        <p className="font-medium">{videoFile.name}</p>
                                        <p className="text-sm text-gray-500">
                                            {(videoFile.size / 1024 / 1024).toFixed(2)} MB
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <Upload className="h-10 w-10 mx-auto mb-2 text-gray-400" />
                                        <p className="text-gray-600">לחץ להעלאת סרטון</p>
                                        <p className="text-sm text-gray-400">MP4, MOV עד 500MB</p>
                                    </>
                                )}
                            </div>
                        )}

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="video/*"
                            onChange={handleFileSelect}
                            className="hidden"
                        />

                        {/* Options */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                            {/* Aspect Ratio */}
                            <div>
                                <label className="block text-sm font-medium mb-2">יחס תמונה</label>
                                <div className="flex gap-2">
                                    {(["9:16", "16:9", "1:1"] as const).map((ratio) => (
                                        <Button
                                            key={ratio}
                                            size="sm"
                                            variant={aspectRatio === ratio ? "default" : "outline"}
                                            onClick={() => setAspectRatio(ratio)}
                                            disabled={isProcessing}
                                        >
                                            {ratio}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {/* Clip Length */}
                            <div>
                                <label className="block text-sm font-medium mb-2">אורך קליפ</label>
                                <div className="flex gap-2">
                                    {[
                                        { value: "short", label: "קצר" },
                                        { value: "medium", label: "בינוני" },
                                        { value: "long", label: "ארוך" },
                                    ].map((option) => (
                                        <Button
                                            key={option.value}
                                            size="sm"
                                            variant={clipLength === option.value ? "default" : "outline"}
                                            onClick={() => setClipLength(option.value as any)}
                                            disabled={isProcessing}
                                        >
                                            {option.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {/* Max Clips */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    מספר קליפים (עד {maxClips})
                                </label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={20}
                                    value={maxClips}
                                    onChange={(e) => setMaxClips(parseInt(e.target.value) || 10)}
                                    disabled={isProcessing}
                                />
                            </div>
                        </div>

                        <div className="bg-yellow-50 p-3 rounded-lg text-sm text-yellow-700">
                            💡 חיתוך סרטון עולה 5 קרדיטים ויכול לקחת 5-10 דקות
                        </div>

                        <Button
                            onClick={handleGenerate}
                            disabled={
                                isProcessing ||
                                (mode === "url" && !videoUrl.trim()) ||
                                (mode === "upload" && !videoFile)
                            }
                            className="w-full"
                            size="lg"
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                                    מעבד סרטון...
                                </>
                            ) : (
                                <>
                                    <Scissors className="ml-2 h-5 w-5" />
                                    חתוך לקליפים (5 קרדיטים)
                                </>
                            )}
                        </Button>

                        {isProcessing && (
                            <div className="space-y-2">
                                <Progress value={progress} />
                                <p className="text-sm text-center text-gray-500">
                                    {progress}% הושלם - אנא המתן בסבלנות
                                </p>
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-50 text-red-600 p-4 rounded-lg">
                                {error}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Results */}
                {clips && clips.length > 0 && (
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>
                                הקליפים שלך ({clips.length})
                            </CardTitle>
                            <Button onClick={handleDownloadAll} variant="outline">
                                <Download className="h-4 w-4 ml-2" />
                                הורד הכל
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {clips.map((clip, index) => (
                                    <div
                                        key={index}
                                        className="bg-gray-50 rounded-lg overflow-hidden border"
                                    >
                                        {/* Video Preview */}
                                        <div className="relative aspect-video bg-black">
                                            {playingClip === clip.url ? (
                                                <video
                                                    src={clip.url}
                                                    controls
                                                    autoPlay
                                                    className="w-full h-full"
                                                    onEnded={() => setPlayingClip(null)}
                                                />
                                            ) : (
                                                <>
                                                    <img
                                                        src={clip.thumbnail}
                                                        alt={clip.title}
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <button
                                                        onClick={() => setPlayingClip(clip.url)}
                                                        className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors"
                                                    >
                                                        <Play className="h-12 w-12 text-white" />
                                                    </button>
                                                </>
                                            )}

                                            {/* Duration Badge */}
                                            <Badge className="absolute bottom-2 right-2 bg-black/70">
                                                {formatDuration(clip.duration)}
                                            </Badge>

                                            {/* Virality Score */}
                                            <Badge
                                                className={`absolute top-2 right-2 ${getViralityColor(clip.viralityScore)}`}
                                            >
                                                <Star className="h-3 w-3 ml-1" />
                                                {clip.viralityScore}%
                                            </Badge>
                                        </div>

                                        {/* Clip Info */}
                                        <div className="p-3">
                                            <h3 className="font-medium mb-1 line-clamp-1">
                                                {clip.title}
                                            </h3>
                                            <p className="text-xs text-gray-500 line-clamp-2 mb-2">
                                                {clip.transcript}
                                            </p>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="w-full"
                                                onClick={() => handleDownload(clip, index)}
                                            >
                                                <Download className="h-4 w-4 ml-1" />
                                                הורד
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}