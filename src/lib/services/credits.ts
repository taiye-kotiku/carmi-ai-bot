import { supabaseAdmin } from "@/lib/supabase/admin";
import { CREDIT_COSTS } from "@/lib/config/credits";

/**
 * Atomically check and deduct credits for a given feature.
 * Uses the database RPC function for atomic operation.
 * Throws if insufficient credits.
 */
export async function deductCredits(
    userId: string,
    feature: string,
    customAmount?: number
): Promise<{ newBalance: number }> {
    const amount = customAmount ?? CREDIT_COSTS[feature];

    if (amount === undefined) {
        throw new Error(`Unknown feature: ${feature}`);
    }

    // Use RPC for atomic deduction
    const { data: newBalance, error } = await supabaseAdmin.rpc("deduct_credits", {
        p_user_id: userId,
        p_cost: amount,
    });

    if (error) {
        // RPC raises exception if insufficient
        throw new Error(
            `אין מספיק קרדיטים (נדרשים ${amount})`
        );
    }

    // Record transaction
    await supabaseAdmin.from("credit_transactions").insert({
        user_id: userId,
        credit_type: "credits",
        amount: -amount,
        balance_after: newBalance,
        reason: feature,
    });

    return { newBalance };
}

/**
 * Add credits back (refund or bonus).
 * Uses the database RPC function for atomic operation.
 */
export async function addCredits(
    userId: string,
    amount: number,
    reason: string,
    relatedId?: string
): Promise<{ newBalance: number }> {
    const { data: newBalance, error } = await supabaseAdmin.rpc("add_credits", {
        p_user_id: userId,
        p_amount: amount,
    });

    if (error) {
        console.error(`[addCredits] RPC error for user ${userId}:`, error);
        return { newBalance: 0 };
    }

    await supabaseAdmin.from("credit_transactions").insert({
        user_id: userId,
        credit_type: "credits",
        amount: amount,
        balance_after: newBalance,
        reason,
        related_id: relatedId || null,
    });

    return { newBalance };
}