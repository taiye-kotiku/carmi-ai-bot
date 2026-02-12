// src/app/credits/success/page.tsx

"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle, Coins, Loader2, ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";

function SuccessContent() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get("order");
    const [status, setStatus] = useState<"loading" | "success" | "pending" | "error">("loading");
    const [credits, setCredits] = useState<number>(0);
    const [retries, setRetries] = useState(0);

    useEffect(() => {
        if (!orderId) {
            setStatus("error");
            return;
        }

        const checkPayment = async () => {
            try {
                const res = await fetch(`/api/payments/verify?order=${orderId}`);
                const data = await res.json();

                if (data.status === "completed") {
                    setCredits(data.credits);
                    setStatus("success");
                } else if (data.status === "pending" && retries < 10) {
                    setTimeout(() => setRetries((r) => r + 1), 2000);
                } else if (data.status === "failed" || data.status === "credit_error") {
                    setStatus("error");
                } else {
                    setStatus("pending");
                }
            } catch {
                setStatus("error");
            }
        };

        checkPayment();
    }, [orderId, retries]);

    return (
        <div className="max-w-md w-full text-center">
            {status === "loading" && (
                <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-lg">
                    <Loader2 className="h-16 w-16 animate-spin text-purple-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        מאמת את התשלום...
                    </h1>
                    <p className="text-gray-500">
                        אנחנו בודקים שהתשלום עבר בהצלחה
                    </p>
                </div>
            )}

            {status === "success" && (
                <div className="bg-white rounded-3xl border border-green-200 p-8 shadow-lg">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="h-10 w-10 text-green-600" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        התשלום הצליח! 🎉
                    </h1>
                    <p className="text-gray-600 mb-6">
                        הקרדיטים נוספו לחשבונך בהצלחה
                    </p>
                    <div className="bg-purple-50 rounded-2xl p-4 mb-8 flex items-center justify-center gap-3">
                        <Coins className="h-6 w-6 text-purple-600" />
                        <span className="text-2xl font-bold text-purple-700">
                            +{credits}
                        </span>
                        <span className="text-purple-600">קרדיטים</span>
                    </div>
                    <div className="space-y-3">
                        <Link
                            href="/generate/image"
                            className="block w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-medium hover:from-purple-600 hover:to-purple-700 transition-all"
                        >
                            התחל ליצור ✨
                        </Link>
                        <Link
                            href="/dashboard"
                            className="block w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
                        >
                            חזרה לדשבורד
                        </Link>
                    </div>
                </div>
            )}

            {status === "pending" && (
                <div className="bg-white rounded-3xl border border-yellow-200 p-8 shadow-lg">
                    <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Loader2 className="h-10 w-10 text-yellow-600 animate-spin" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        התשלום בעיבוד
                    </h1>
                    <p className="text-gray-600 mb-6">
                        התשלום שלך התקבל ונמצא בעיבוד. הקרדיטים יתווספו בדקות הקרובות.
                    </p>
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        חזרה לדשבורד
                    </Link>
                </div>
            )}

            {status === "error" && (
                <div className="bg-white rounded-3xl border border-red-200 p-8 shadow-lg">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertCircle className="h-10 w-10 text-red-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        משהו השתבש
                    </h1>
                    <p className="text-gray-600 mb-6">
                        לא הצלחנו לאמת את התשלום. אם חויבת, אנא צור קשר איתנו ונטפל בזה.
                    </p>
                    <div className="space-y-3">
                        <Link
                            href="/credits"
                            className="block w-full py-3 px-4 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-all"
                        >
                            נסה שוב
                        </Link>
                        <Link
                            href="/contact"
                            className="block w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
                        >
                            צור קשר
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function PaymentSuccessPage() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center px-4" dir="rtl">
            <Suspense
                fallback={
                    <div className="max-w-md w-full text-center">
                        <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-lg">
                            <Loader2 className="h-16 w-16 animate-spin text-purple-500 mx-auto mb-4" />
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">
                                טוען...
                            </h1>
                        </div>
                    </div>
                }
            >
                <SuccessContent />
            </Suspense>
        </div>
    );
}