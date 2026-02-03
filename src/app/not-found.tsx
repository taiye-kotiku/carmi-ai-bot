import Link from "next/link";

export default function NotFound() {
    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-8" dir="rtl">
            <div className="text-center">
                <h1 className="text-6xl font-bold text-purple-500 mb-4">404</h1>
                <h2 className="text-2xl font-bold mb-4">הדף לא נמצא</h2>
                <p className="text-zinc-400 mb-6">הדף שחיפשת לא קיים.</p>
                <Link
                    href="/"
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg inline-block"
                >
                    חזרה לדף הבית
                </Link>
            </div>
        </div>
    );
}