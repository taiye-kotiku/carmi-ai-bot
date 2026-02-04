"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Image, Film, Video, LayoutGrid, Check, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function CreditsPage() {
    const [credits, setCredits] = useState<{
        image_credits: number;
        reel_credits: number;
        video_credits: number;
        carousel_credits: number;
    } | null>(null);
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
                setCredits({
                    image_credits: data.image_credits ?? 0,
                    reel_credits: data.reel_credits ?? 0,
                    video_credits: data.video_credits ?? 0,
                    carousel_credits: data.carousel_credits ?? 0,
                });
            }
        } catch (error) {
            console.error("Failed to fetch credits");
        } finally {
            setLoading(false);
        }
    }

    const plans = [
        {
            name: "חינם",
            price: "₪0",
            period: "/חודש",
            popular: false,
            features: [
                "10 יצירות תמונה",
                "2 המרות רילז",
                "5 קרוסלות",
            ],
            cta: "התחל בחינם",
            href: "/signup",
        },
        {
            name: "סטארטר",
            price: "₪139",
            period: "/חודש",
            popular: true,
            features: [
                "250 מודעות / תמונות בחודש",
                "20 קרוסלות מותאמות",
                "סוכן קופירייטר מקצועי",
                "מחולל תמונות יצירתי ומתקדם",
                "יצירת תוכן מותאם אישית",
                "עריכת תמונות עם AI",
                "יצירת סרטונים עם הדמות שלך",
                "דמות ראשונה בחינם",
            ],
            cta: "בחר בתוכנית",
            href: "/signup?plan=starter",
        },
        {
            name: "יוצר תוכן מקצועי",
            price: "₪229",
            period: "/חודש",
            popular: false,
            features: [
                "500 מודעות / תמונות בחודש",
                "50 קרוסלות מותאמות",
                "סוכן קופירייטר מקצועי",
                "מחולל תמונות יצירתי ומתקדם",
                "יצירת תוכן מותאם אישית",
                "עריכת תמונות עם AI",
                "יצירת סרטונים מקצועיים עם הדמות שלך",
                "2 דמויות ראשונות בחינם",
            ],
            cta: "בחר בתוכנית",
            href: "/signup?plan=pro",
        },
    ];

    return (
        <div className="min-h-screen bg-gray-50 p-8" dir="rtl">
            <div className="max-w-6xl mx-auto">
                <div className="mb-4 flex items-center justify-between">
                    <a href="/" className="text-sm text-gray-500 hover:text-gray-700">← חזרה לדף הבית</a>
                </div>
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900">מנוי וקרדיטים</h1>
                    <p className="text-gray-500 mt-1">נהל את הקרדיטים שלך ושדרג את המנוי</p>
                    <p className="text-amber-600 text-sm mt-2 bg-amber-50 px-3 py-2 rounded-lg">
                        תצוגה מקדימה – <a href="/login" className="underline font-medium">התחבר</a> כדי לראות את היתרה האמיתית
                    </p>
                </div>

                {/* Current balance */}
                <Card className="mb-8">
                    <CardContent className="p-6">
                        <h2 className="text-lg font-semibold mb-4">היתרה הנוכחית</h2>
                        {loading ? (
                            <div className="flex items-center gap-2 text-gray-500">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                טוען...
                            </div>
                        ) : credits ? (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-purple-50 rounded-xl p-4 flex items-center gap-3">
                                    <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                        <Image className="h-5 w-5 text-purple-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-gray-900">{credits.image_credits}</p>
                                        <p className="text-sm text-gray-500">תמונות</p>
                                    </div>
                                </div>
                                <div className="bg-cyan-50 rounded-xl p-4 flex items-center gap-3">
                                    <div className="h-10 w-10 bg-cyan-100 rounded-lg flex items-center justify-center">
                                        <Film className="h-5 w-5 text-cyan-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-gray-900">{credits.reel_credits}</p>
                                        <p className="text-sm text-gray-500">רילז</p>
                                    </div>
                                </div>
                                <div className="bg-amber-50 rounded-xl p-4 flex items-center gap-3">
                                    <div className="h-10 w-10 bg-amber-100 rounded-lg flex items-center justify-center">
                                        <Video className="h-5 w-5 text-amber-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-gray-900">{credits.video_credits}</p>
                                        <p className="text-sm text-gray-500">סרטונים</p>
                                    </div>
                                </div>
                                <div className="bg-emerald-50 rounded-xl p-4 flex items-center gap-3">
                                    <div className="h-10 w-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                                        <LayoutGrid className="h-5 w-5 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-gray-900">{credits.carousel_credits}</p>
                                        <p className="text-sm text-gray-500">קרוסלות</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-gray-500">לא הצלחנו לטעון את היתרה</p>
                        )}
                    </CardContent>
                </Card>

                {/* Plans */}
                <h2 className="text-lg font-semibold mb-4">תוכניות מנוי</h2>
                <div className="grid md:grid-cols-3 gap-6">
                    {plans.map((plan) => (
                        <Card
                            key={plan.name}
                            className={`relative ${plan.popular ? "border-purple-500 border-2 shadow-lg" : ""}`}
                        >
                            {plan.popular && (
                                <div className="absolute -top-3 right-4 bg-amber-400 text-amber-950 text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1">
                                    <Zap className="h-3 w-3" />
                                    הכי פופולרי
                                </div>
                            )}
                            <CardContent className="p-6">
                                <h3 className="text-lg font-semibold mb-2">{plan.name}</h3>
                                <div className="mb-6">
                                    <span className="text-3xl font-bold">{plan.price}</span>
                                    <span className="text-gray-500">{plan.period}</span>
                                </div>
                                <ul className="space-y-3 mb-6">
                                    {plan.features.map((f) => (
                                        <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                                            <Check className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                                            <span>{f}</span>
                                        </li>
                                    ))}
                                </ul>
                                <Button
                                    className="w-full"
                                    variant={plan.popular ? "default" : "outline"}
                                    asChild
                                >
                                    <Link href={plan.href}>{plan.cta}</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="mt-8">
                    <Button variant="ghost" onClick={() => router.back()} className="text-gray-500">
                        ← חזרה
                    </Button>
                </div>
            </div>
        </div>
    );
}
