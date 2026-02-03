"use client";

import { useEffect } from "react";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-8" dir="rtl">
            <div className="text-center">
                <h2 className="text-2xl font-bold mb-4">משהו השתבש</h2>
                <p className="text-zinc-400 mb-6">אירעה שגיאה. נסה שוב.</p>
                <button
                    onClick={reset}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg"
                >
                    נסה שוב
                </button>
            </div>
        </div>
    );
}