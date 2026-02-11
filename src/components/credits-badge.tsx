// src/components/credits-badge.tsx

"use client";

import { useCredits } from "@/hooks/use-credits";
import { Coins, Loader2 } from "lucide-react";

export function CreditsBadge() {
    const { credits, loading } = useCredits();

    return (
        <div className="flex items-center gap-1.5 bg-purple-50 text-purple-700 px-3 py-1.5 rounded-full text-sm font-medium">
            {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
                <>
                    <Coins className="h-4 w-4" />
                    <span>{credits} קרדיטים</span>
                </>
            )}
        </div>
    );
}