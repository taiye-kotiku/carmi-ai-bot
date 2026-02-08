// src/app/api/characters/[id]/train/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { startLoraTraining } from "@/lib/services/modal";

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        // ─── Auth ───
        const supabase = await createClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const characterId = params.id;
        const admin = createAdminClient();

        // ─── Fetch character & verify ownership ───
        const { data: character, error: fetchError } = await admin
            .from("characters")
            .select("*")
            .eq("id", characterId)
            .eq("user_id", user.id)
            .single();

        if (fetchError || !character) {
            return NextResponse.json(
                { error: "Character not found" },
                { status: 404 }
            );
        }

        if (character.status === "training") {
            return NextResponse.json(
                { error: "Character is already being trained" },
                { status: 409 }
            );
        }

        const imageUrls = character.image_urls || [];
        if (imageUrls.length < 5) {
            return NextResponse.json(
                { error: `Need at least 5 reference images. Currently have ${imageUrls.length}.` },
                { status: 400 }
            );
        }

        // ─── Check credits ───
        const TRAINING_COST = 10;
        const { data: credits, error: creditsError } = await admin
            .from("credits")
            .select("*")
            .eq("user_id", user.id)
            .single();

        if (creditsError || !credits) {
            return NextResponse.json(
                { error: "Could not fetch credits" },
                { status: 500 }
            );
        }

        if (credits.image_credits < TRAINING_COST) {
            return NextResponse.json(
                { error: `Insufficient credits. Training costs ${TRAINING_COST}. You have ${credits.image_credits}.` },
                { status: 402 }
            );
        }

        // ─── Deduct credits ───
        const newBalance = credits.image_credits - TRAINING_COST;
        await admin
            .from("credits")
            .update({ image_credits: newBalance })
            .eq("user_id", user.id);

        await admin.from("credit_transactions").insert({
            user_id: user.id,
            credit_type: "image_credits",
            amount: -TRAINING_COST,
            balance_after: newBalance,
            reason: "character_training",
            related_id: characterId,
        });

        // ─── Update character status ───
        await admin
            .from("characters")
            .update({
                status: "training",
                training_started_at: new Date().toISOString(),
                training_error: null,
            })
            .eq("id", characterId);

        // ─── Parse optional training config ───
        let trainingConfig: Record<string, number> = {};
        try {
            const body = await request.json();
            if (body && typeof body === "object") {
                trainingConfig = {
                    num_train_steps: body.num_train_steps,
                    learning_rate: body.learning_rate,
                    lora_rank: body.lora_rank,
                    resolution: body.resolution,
                };
            }
        } catch {
            // empty body is fine
        }

        // ─── Log what we're about to do ───
        const modalUrl = process.env.MODAL_TRAINING_URL;
        console.log("[Train] MODAL_TRAINING_URL:", modalUrl);
        console.log("[Train] Character:", characterId, character.name);
        console.log("[Train] Images:", imageUrls.length);
        console.log("[Train] Webhook URL:", `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/training-complete`);

        if (!modalUrl) {
            // Refund immediately
            await admin
                .from("credits")
                .update({ image_credits: credits.image_credits })
                .eq("user_id", user.id);
            await admin.from("credit_transactions").insert({
                user_id: user.id,
                credit_type: "image_credits",
                amount: TRAINING_COST,
                balance_after: credits.image_credits,
                reason: "training_refund_no_modal_url",
                related_id: characterId,
            });
            await admin
                .from("characters")
                .update({ status: "failed", training_error: "MODAL_TRAINING_URL not configured" })
                .eq("id", characterId);

            return NextResponse.json(
                { error: "Training service not configured. MODAL_TRAINING_URL is missing." },
                { status: 500 }
            );
        }

        // ─── Call Modal ───
        try {
            const result = await startLoraTraining({
                characterId,
                characterName: character.name,
                referenceImageUrls: imageUrls,
                ...trainingConfig,
            });

            if (!result.success) {
                await admin
                    .from("credits")
                    .update({ image_credits: credits.image_credits })
                    .eq("user_id", user.id);
                await admin.from("credit_transactions").insert({
                    user_id: user.id,
                    credit_type: "image_credits",
                    amount: TRAINING_COST,
                    balance_after: credits.image_credits,
                    reason: "training_refund_modal_rejected",
                    related_id: characterId,
                });
                await admin
                    .from("characters")
                    .update({ status: "failed", training_error: result.errors?.join(", ") || "Modal rejected" })
                    .eq("id", characterId);

                return NextResponse.json(
                    { error: "Failed to start training", details: result.errors },
                    { status: 500 }
                );
            }

            return NextResponse.json({
                success: true,
                message: result.message,
                character_id: characterId,
                config: result.config,
            });
        } catch (modalError) {
            // ─── THIS IS WHERE YOUR ERROR IS HAPPENING ───
            const errorMessage = modalError instanceof Error ? modalError.message : String(modalError);
            console.error("[Train] Modal request failed:", errorMessage);
            console.error("[Train] Full error:", modalError);

            // Refund
            await admin
                .from("credits")
                .update({ image_credits: credits.image_credits })
                .eq("user_id", user.id);
            await admin.from("credit_transactions").insert({
                user_id: user.id,
                credit_type: "image_credits",
                amount: TRAINING_COST,
                balance_after: credits.image_credits,
                reason: "training_refund_modal_error",
                related_id: characterId,
            });
            await admin
                .from("characters")
                .update({
                    status: "failed",
                    training_error: errorMessage,
                })
                .eq("id", characterId);

            return NextResponse.json(
                {
                    error: "Failed to connect to training service",
                    details: errorMessage,
                    modal_url: modalUrl,
                },
                { status: 502 }
            );
        }
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("[Train] Unexpected error:", msg);
        return NextResponse.json(
            { error: "Internal server error", details: msg },
            { status: 500 }
        );
    }
}