"use client";

import { useState } from "react";

export default function BrandPage() {
    const [brandName, setBrandName] = useState("");
    const [colors, setColors] = useState<string[]>([]);
    const [logo, setLogo] = useState<File | null>(null);

    return (
        <div className="min-h-screen bg-black text-white p-8" dir="rtl">
            <h1 className="text-3xl font-bold mb-8">הגדרות מותג</h1>

            <div className="max-w-2xl space-y-6">
                <div>
                    <label className="block mb-2">שם המותג</label>
                    <input
                        type="text"
                        value={brandName}
                        onChange={(e) => setBrandName(e.target.value)}
                        className="w-full p-3 bg-zinc-900 border border-zinc-700 rounded-lg"
                        placeholder="הכנס שם מותג..."
                    />
                </div>

                <div>
                    <label className="block mb-2">לוגו</label>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setLogo(e.target.files?.[0] || null)}
                        className="w-full p-3 bg-zinc-900 border border-zinc-700 rounded-lg"
                    />
                </div>

                <div>
                    <label className="block mb-2">צבעי מותג</label>
                    <p className="text-zinc-400 text-sm">בקרוב...</p>
                </div>

                <button className="w-full py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium">
                    שמור הגדרות
                </button>
            </div>
        </div>
    );
}