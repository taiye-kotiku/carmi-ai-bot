// src/app/credits/page.tsx

"use client";

import { useState } from "react";
import { useCredits } from "@/hooks/use-credits";
import { CREDIT_PLANS } from "@/lib/cardcom/plans";
import { CREDIT_COSTS } from "@/lib/config/credits";
import {
    Coins,
    Sparkles,
    Check,
    Loader2,
    CreditCard,
    Zap,
    Crown,
    Building2,
    Image,
    Video,
    Film,
    Layers,
    ArrowLeft,
} from "lucide-react";
import Link from "next/link";

const PLAN_ICONS: Record<string, React.ReactNode> = {
    starter: <Zap className="h-6 w-6" />,
    creator: <Sparkles className="h-6 w-6" />,
    pro: <Crown className="h-6 w-6" />,
    business: <Building2 className="h-6 w-6" />,
};

const PLAN_COLORS: Record<string, string> = {
    starter: "from-blue-500 to-blue-600",
    creator: "from-purple-500 to-purple-600",
    pro: "from-amber-500 to-orange-600",
    business: "from-emerald-500 to-emerald-600",
};

const PLAN_BORDER_COLORS: Record<string, string> = {
    starter: "border-blue-200 hover:border-blue-400",
    creator: "border-purple-400 ring-2 ring-purple-200",
    pro: "border-amber-200 hover:border-amber-400",
    business: "border-emerald-200 hover:border-emerald-400",
};

export default function CreditsPage() {
    const { credits, loading: creditsLoading } = useCredits();
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handlePurchase = async (planId: string) => {
        setLoadingPlan(planId);
        setError(null);

        try {
            const response = await fetch("/api/payments/create-session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ planId }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to create payment session");
            }

            // Redirect to Cardcom payment page
            window.location.href = data.url;
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "אירעה שגיאה. נסה שוב."
            );
            setLoadingPlan(null);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white" dir="rtl">
            {/* Header */}
            <div className="max-w-6xl mx-auto px-4 py-8">
                <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-8 transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    חזרה לדשבורד
                </Link>

                {/* Title Section */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
                        <Coins className="h-4 w-4" />
                        <span>חנות קרדיטים</span>
                    </div>
                    <h1 className="text-4xl font-bold text-gray-900 mb-3">
                        קנה קרדיטים ליצירת תוכן
                    </h1>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                        הקרדיטים הללו ישמשו אותך לחודש הקרוב בלבד. תוכל להשתמש בהם בכל הכלים.
                    </p>

                    {/* Current Balance */}
                    <div className="mt-6 inline-flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-6 py-3 shadow-sm">
                        <Coins className="h-5 w-5 text-purple-600" />
                        <span className="text-gray-600">היתרה שלך:</span>
                        {creditsLoading ? (
                            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                        ) : (
                            <span className="text-2xl font-bold text-purple-700">
                                {credits}
                            </span>
                        )}
                        <span className="text-gray-500">קרדיטים</span>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="max-w-md mx-auto mb-8 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-center">
                        {error}
                    </div>
                )}

                {/* Plans Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
                    {CREDIT_PLANS.map((plan) => (
                        <div
                            key={plan.id}
                            className={`relative bg-white rounded-2xl border-2 p-6 transition-all duration-200 hover:shadow-lg ${PLAN_BORDER_COLORS[plan.id]
                                } ${plan.popular ? "scale-[1.02] shadow-lg" : ""}`}
                        >
                            {/* Popular Badge */}
                            {plan.popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <span className="bg-gradient-to-r from-purple-500 to-purple-600 text-white text-xs font-bold px-4 py-1 rounded-full shadow-md">
                                        ⭐ הכי פופולרי
                                    </span>
                                </div>
                            )}

                            {/* Plan Header */}
                            <div className="text-center mb-6">
                                <div
                                    className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-r ${PLAN_COLORS[plan.id]} text-white mb-3`}
                                >
                                    {PLAN_ICONS[plan.id]}
                                </div>
                                <h3 className="text-xl font-bold text-gray-900">
                                    {plan.nameHe}
                                </h3>
                                {plan.savings && (
                                    <span className="inline-block mt-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                        {plan.savings}
                                    </span>
                                )}
                            </div>

                            {/* Price */}
                            <div className="text-center mb-6">
                                <div className="flex items-baseline justify-center gap-1">
                                    <span className="text-4xl font-bold text-gray-900">
                                        ₪{plan.price}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-500 mt-1">
                                    {plan.credits} קרדיטים • ₪{plan.pricePerCredit.toFixed(2)}{" "}
                                    לקרדיט
                                </p>
                            </div>

                            {/* Features */}
                            <ul className="space-y-3 mb-6">
                                {plan.features.map((feature, i) => (
                                    <li
                                        key={i}
                                        className="flex items-center gap-2 text-sm text-gray-600"
                                    >
                                        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            {/* Purchase Button */}
                            <button
                                onClick={() => handlePurchase(plan.id)}
                                disabled={loadingPlan !== null}
                                className={`w-full py-3 px-4 rounded-xl font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 ${plan.popular
                                        ? "bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 shadow-md hover:shadow-lg"
                                        : "bg-gray-900 text-white hover:bg-gray-800"
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {loadingPlan === plan.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <CreditCard className="h-4 w-4" />
                                )}
                                {loadingPlan === plan.id ? "מעבד..." : "רכוש עכשיו"}
                            </button>
                        </div>
                    ))}
                </div>

                {/* Credit Costs Table */}
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
                        כמה עולה כל פעולה?
                    </h2>
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                        <div className="grid grid-cols-2 gap-0 divide-y divide-gray-100">
                            {Object.entries(CREDIT_COSTS).map(([action, cost]) => {
                                const actionLabels: Record<string, { icon: React.ReactNode; label: string }> = {
                                    image: { icon: <Image className="h-4 w-4" />, label: "יצירת תמונה" },
                                    carousel: { icon: <Layers className="h-4 w-4" />, label: "קרוסלה" },
                                    video: { icon: <Video className="h-4 w-4" />, label: "וידאו מתמונה" },
                                    text_to_video: { icon: <Film className="h-4 w-4" />, label: "טקסט לוידאו" },
                                    text_to_image: { icon: <Image className="h-4 w-4" />, label: "טקסט לתמונה" },
                                    cartoonize: { icon: <Sparkles className="h-4 w-4" />, label: "קריקטורה" },
                                    character_train: { icon: <Crown className="h-4 w-4" />, label: "אימון דמות" },
                                    character_image: { icon: <Image className="h-4 w-4" />, label: "תמונת דמות" },
                                    character_video: { icon: <Video className="h-4 w-4" />, label: "וידאו דמות" },
                                    reel: { icon: <Film className="h-4 w-4" />, label: "ריל" },
                                    video_clips: { icon: <Film className="h-4 w-4" />, label: "חיתוך וידאו" },
                                };

                                const info = actionLabels[action] || {
                                    icon: <Coins className="h-4 w-4" />,
                                    label: action,
                                };

                                return (
                                    <div
                                        key={action}
                                        className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-purple-600">{info.icon}</span>
                                            <span className="text-gray-700 font-medium">
                                                {info.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-bold text-gray-900">{cost}</span>
                                            <Coins className="h-3.5 w-3.5 text-amber-500" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Trust Section */}
                <div className="mt-12 text-center text-sm text-gray-500 space-y-2">
                    <p>🔒 תשלום מאובטח באמצעות Cardcom</p>
                    <p>   • ניתן לרכוש שוב בכל עת • </p>
                    <div className="flex items-center justify-center gap-4 mt-4">
                        <Link
                            href="/terms"
                            className="text-purple-600 hover:text-purple-700 hover:underline"
                        >
                            תנאי שימוש
                        </Link>
                        <Link
                            href="/privacy"
                            className="text-purple-600 hover:text-purple-700 hover:underline"
                        >
                            מדיניות פרטיות
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}