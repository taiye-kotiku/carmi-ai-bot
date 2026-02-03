"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CreditsPage() {
    const [credits, setCredits] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        fetchCredits();
    }, []);

    async function fetchCredits() {
        try {
            const res = await fetch("/api/user/credits");
            if (res.ok) {
                const data = await res.json();
                setCredits(data.credits);
            }
        } catch (error) {
            console.error("Failed to fetch credits");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-black text-white p-8" dir="rtl">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold mb-8">קרדיטים</h1>

                <div className="bg-zinc-900 rounded-2xl p-8 mb-8">
                    <p className="text-zinc-400 mb-2">היתרה שלך</p>
                    <p className="text-5xl font-bold text-purple-400">
                        {loading ? "..." : credits ?? 0}
                    </p>
                    <p className="text-zinc-500 mt-2">קרדיטים</p>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                    {[
                        { amount: 100, price: "₪29", popular: false },
                        { amount: 500, price: "₪99", popular: true },
                        { amount: 1500, price: "₪199", popular: false },
                    ].map((plan) => (
                        <div
                            key={plan.amount}
                            className={`p-6 rounded-xl border ${plan.popular
                                    ? "border-purple-500 bg-purple-500/10"
                                    : "border-zinc-700 bg-zinc-900"
                                }`}
                        >
                            {plan.popular && (
                                <span className="text-xs bg-purple-500 px-2 py-1 rounded-full mb-4 inline-block">
                                    הכי פופולרי
                                </span>
                            )}
                            <p className="text-3xl font-bold">{plan.amount}</p>
                            <p className="text-zinc-400 mb-4">קרדיטים</p>
                            <p className="text-2xl font-bold mb-4">{plan.price}</p>
                            <button className="w-full py-3 bg-purple-600 hover:bg-purple-700 rounded-lg">
                                רכוש עכשיו
                            </button>
                        </div>
                    ))}
                </div>

                <button
                    onClick={() => router.back()}
                    className="mt-8 text-zinc-400 hover:text-white"
                >
                    ← חזרה
                </button>
            </div>
        </div>
    );
}