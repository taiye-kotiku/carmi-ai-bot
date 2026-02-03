"use client";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html lang="he" dir="rtl">
            <body className="bg-black text-white min-h-screen flex items-center justify-center">
                <div className="text-center p-8">
                    <h2 className="text-2xl font-bold mb-4">משהו השתבש</h2>
                    <button
                        onClick={reset}
                        className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg"
                    >
                        נסה שוב
                    </button>
                </div>
            </body>
        </html>
    );
}