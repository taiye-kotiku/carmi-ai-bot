// src/app/api/webhooks/training-complete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

interface TrainingWebhookPayload {
    character_id: string;
    status: "ready" | "failed";
    model_url?: string;
    trigger_word?: string;
    error?: string;
    training_config?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
    try {
        const payload: TrainingWebhookPayload = await request.json();

        console.log("[Webhook] Training complete:", {
            character_id: payload.character_id,
            status: payload.status,
            has_model_url: !!payload.model_url,
            trigger_word: payload.trigger_word,
            error: payload.error,
        });

        const { character_id, status, model_url, trigger_word, error } = payload;

        if (!character_id) {
            return NextResponse.json(
                { error: "Missing character_id" },
                { status: 400 }
            );
        }

        const admin = supabaseAdmin;

        // Fetch the character to get user_id for potential refund
        const { data: character, error: fetchError } = await admin
            .from("characters")
            .select("user_id, settings")
            .eq("id", character_id)
            .single();

        if (fetchError || !character) {
            console.error("[Webhook] Character not found:", character_id);
            return NextResponse.json(
                { error: "Character not found" },
                { status: 404 }
            );
        }

        if (status === "ready" && model_url) {
            // ─── Training succeeded ───
            const updatedSettings = {
                ...(character.settings || {}),
                trigger_word: trigger_word || "TOK",
            };

            const { error: updateError } = await admin
                .from("characters")
                .update({
                    status: "ready",
                    lora_url: model_url,
                    settings: updatedSettings,
                    trained_at: new Date().toISOString(),
                    error_message: null,
                })
                .eq("id", character_id);

            if (updateError) {
                console.error("[Webhook] Failed to update character:", updateError);
                return NextResponse.json(
                    { error: "Database update failed" },
                    { status: 500 }
                );
            }

            console.log(`[Webhook] ✅ Character ${character_id} is ready`);
        } else if (status === "failed") {
            // ─── Training failed — update status and refund credits ───
            await admin
                .from("characters")
                .update({
                    status: "failed",
                    error_message: error || "Training failed on GPU",
                    trained_at: new Date().toISOString(),
                })
                .eq("id", character_id);

            // Refund credits
            const TRAINING_COST = 10;
            const { data: credits } = await admin
                .from("credits")
                .select("image_credits")
                .eq("user_id", character.user_id)
                .single();

            if (credits) {
                const refundedBalance = credits.image_credits + TRAINING_COST;
                await admin
                    .from("credits")
                    .update({ image_credits: refundedBalance })
                    .eq("user_id", character.user_id);

                await admin.from("credit_transactions").insert({
                    user_id: character.user_id,
                    credit_type: "image_credits",
                    amount: TRAINING_COST,
                    balance_after: refundedBalance,
                    reason: "training_refund_failed",
                    related_id: character_id,
                });

                console.log(
                    `[Webhook] 💰 Refunded ${TRAINING_COST} credits to user ${character.user_id}`
                );
            }

            console.log(`[Webhook] ❌ Character ${character_id} failed: ${error}`);
        } else {
            return NextResponse.json(
                { error: "Invalid status. Must be 'ready' or 'failed'" },
                { status: 400 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[Webhook] Processing error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}