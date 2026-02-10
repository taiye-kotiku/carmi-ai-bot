"use client";

import { Button } from "@/components/ui/button";
import { Download, Instagram, Music } from "lucide-react";
import { ExportFormat, FORMAT_DIMENSIONS, downloadResizedImage } from "@/lib/services/image-resizer";
import { useState } from "react";

interface ExportFormatsProps {
    imageUrl: string;
    baseFilename?: string;
}

export function ExportFormats({ imageUrl, baseFilename }: ExportFormatsProps) {
    const [exporting, setExporting] = useState<ExportFormat | null>(null);

    const handleExport = async (format: ExportFormat) => {
        setExporting(format);
        try {
            await downloadResizedImage(imageUrl, format, baseFilename);
        } catch (error) {
            console.error("Export failed:", error);
            alert("שגיאה ביצוא התמונה");
        } finally {
            setExporting(null);
        }
    };

    const formats: ExportFormat[] = ["instagram-post", "instagram-story", "instagram-reel", "tiktok"];

    return (
        <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">ייצא לפורמטים שונים:</h4>
            <div className="grid grid-cols-2 gap-2">
                {formats.map((format) => {
                    const dims = FORMAT_DIMENSIONS[format];
                    const isExporting = exporting === format;
                    
                    let icon = <Download className="h-4 w-4" />;
                    if (format.includes("instagram")) {
                        icon = <Instagram className="h-4 w-4" />;
                    } else if (format === "tiktok") {
                        icon = <Music className="h-4 w-4" />;
                    }
                    
                    return (
                        <Button
                            key={format}
                            variant="outline"
                            size="sm"
                            onClick={() => handleExport(format)}
                            disabled={isExporting}
                            className="text-xs"
                        >
                            {isExporting ? (
                                <>
                                    <div className="h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin ml-1" />
                                    מייצא...
                                </>
                            ) : (
                                <>
                                    {icon}
                                    <span className="mr-1">{dims.name}</span>
                                    <span className="text-gray-500 text-[10px]">
                                        ({dims.width}×{dims.height})
                                    </span>
                                </>
                            )}
                        </Button>
                    );
                })}
            </div>
        </div>
    );
}
