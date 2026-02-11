// src/hooks/use-credits.ts

"use client";

import { useState, useEffect, useCallback } from "react";
import { CREDIT_COSTS, CreditAction } from "@/lib/config/credits";

interface UseCreditsReturn {
    credits: number;
    loading: boolean;
    canAfford: (action: CreditAction) => boolean;
    getCost: (action: CreditAction) => number;
    refresh: () => Promise<void>;
}

export function useCredits(): UseCreditsReturn {
    const [credits, setCredits] = useState(0);
    const [loading, setLoading] = useState(true);

    const fetchCredits = useCallback(async () => {
        try {
            const res = await fetch("/api/user/credits");
            if (res.ok) {
                const data = await res.json();
                setCredits(data.credits);
            }
        } catch (err) {
            console.error("Failed to fetch credits:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCredits();
    }, [fetchCredits]);

    const canAfford = useCallback(
        (action: CreditAction) => credits >= CREDIT_COSTS[action],
        [credits]
    );

    const getCost = useCallback(
        (action: CreditAction) => CREDIT_COSTS[action],
        []
    );

    return {
        credits,
        loading,
        canAfford,
        getCost,
        refresh: fetchCredits,
    };
}