"use client";

import { Play } from "lucide-react";

interface InstagramPreviewProps {
    imageUrl: string | null;
    aspectRatio?: string;
    className?: string;
}

/**
 * Instagram-like phone mock showing how the generated image would look in a social feed.
 */
export function InstagramPreview({ imageUrl, aspectRatio = "1:1", className = "" }: InstagramPreviewProps) {
    return (
        <div className={`bg-white rounded-[2.5rem] border-4 border-gray-800 shadow-2xl overflow-hidden max-w-[280px] mx-auto ${className}`}>
            {/* Phone notch */}
            <div className="h-6 bg-gray-800 rounded-b-2xl flex justify-center items-end pb-1">
                <div className="w-20 h-2 bg-gray-900 rounded-full" />
            </div>

            {/* Status bar */}
            <div className="px-4 py-2 flex justify-between items-center text-xs text-gray-600 bg-white border-b">
                <span>10:00</span>
                <div className="flex gap-1">
                    <span>●●●</span>
                </div>
            </div>

            {/* Profile header */}
            <div className="px-4 pt-3 pb-2 border-b">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">יוצר תוכן</p>
                        <p className="text-xs text-gray-500 truncate">יוצר תוכן דיגיטלי</p>
                    </div>
                </div>
                <div className="flex gap-4 text-center text-xs mb-2">
                    <span><strong>500</strong> פוסטים</span>
                    <span><strong>10K</strong> עוקבים</span>
                    <span><strong>1,234</strong> נעקבים</span>
                </div>
                <div className="flex gap-2">
                    <button className="flex-1 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-medium">לעקוב</button>
                    <button className="flex-1 py-1.5 rounded-lg border border-gray-300 text-xs">הודעה</button>
                    <button className="flex-1 py-1.5 rounded-lg border border-gray-300 text-xs">אימייל</button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b">
                <div className="flex-1 py-2 flex justify-center border-b-2 border-gray-400">
                    <div className="w-5 h-5 grid grid-cols-2 gap-0.5" />
                </div>
                <div className="flex-1 py-2 flex justify-center border-b-2 border-gray-900">
                    <Play className="w-5 h-5" />
                </div>
                <div className="flex-1 py-2 flex justify-center border-b-2 border-gray-400">
                    <div className="w-5 h-5 rounded border" />
                </div>
            </div>

            {/* Reels grid - generated image in first slot */}
            <div className="grid grid-cols-3 gap-0.5 p-0.5 bg-gray-100">
                {/* First slot: generated image or placeholder */}
                <div className="aspect-square bg-gray-200 relative overflow-hidden">
                    {imageUrl ? (
                        <img
                            src={imageUrl}
                            alt="תצוגה מקדימה"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-300">
                            <Play className="w-8 h-8 text-gray-500 opacity-50" />
                        </div>
                    )}
                    <div className="absolute bottom-1 right-1 text-[10px] text-white font-medium drop-shadow-md flex items-center gap-0.5">
                        <Play className="w-3 h-3 fill-current" />
                        0:15
                    </div>
                </div>

                {/* Placeholder slots */}
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="aspect-square bg-gray-300 relative overflow-hidden">
                        <div className="w-full h-full flex items-center justify-center">
                            <Play className="w-6 h-6 text-gray-400" />
                        </div>
                        <div className="absolute bottom-1 right-1 text-[10px] text-gray-500">0:15</div>
                    </div>
                ))}
            </div>

            {/* Bottom nav */}
            <div className="flex justify-around py-2 border-t bg-white">
                <div className="w-6 h-6 rounded" />
                <div className="w-6 h-6 rounded" />
                <div className="w-6 h-6 rounded border-2 border-gray-900" />
                <div className="w-6 h-6 rounded" />
                <div className="w-6 h-6 rounded-full bg-gray-300" />
            </div>
        </div>
    );
}
