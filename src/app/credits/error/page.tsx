// src/app/credits/error/page.tsx

"use client";

import { XCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function PaymentErrorPage() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center px-4" dir="rtl">
            <div className="max-w-md w-full text-center">
                <div className="bg-white rounded-3xl border border-red-200 p-8 shadow-lg">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <XCircle className="h-10 w-10 text-red-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        התשלום נכשל
                    </h1>
                    <p className="text-gray-600 mb-8">
                        התשלום לא הושלם. לא בוצע חיוב. אפשר לנסות שוב.
                    </p>
                    <div className="space-y-3">
                        <Link
                            href="/credits"
                            className="block w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-medium hover:from-purple-600 hover:to-purple-700 transition-all"
                        >
                            נסה שוב
                        </Link>
                        <Link
                            href="/dashboard"
                            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium mt-4"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            חזרה לדשבורד
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}