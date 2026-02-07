// src/app/api/characters/[id]/train/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { startLoraTraining } from "@/lib/services/modal";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
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

        const { id: characterId } = await params;

        // ─── Fetch character & verify ownership ───
        const { data: character, error: fetchError } = await supabaseAdmin
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

        // Check status
        if (character.model_status === "training") {
            return NextResponse.json(
                { error: "Character is already being trained" },
                { status: 409 }
            );
        }

        // Check images
        const imageUrls = character.reference_images || [];
        if (imageUrls.length < 5) {
            return NextResponse.json(
                {
                    error: `Need at least 5 reference images. Currently have ${imageUrls.length}.`,
                },
                { status: 400 }
            );
        }

        // ─── Check credits ───
        const TRAINING_COST = 10; // image_credits cost for training
        const { data: credits, error: creditsError } = await supabaseAdmin
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
                {
                    error: `Insufficient credits. Training costs ${TRAINING_COST} image credits. You have ${credits.image_credits}.`,
                },
                { status: 402 }
            );
        }

        // ─── Deduct credits ───
        const newBalance = credits.image_credits - TRAINING_COST;
        await supabaseAdmin
            .from("credits")
            .update({ image_credits: newBalance })
            .eq("user_id", user.id);

        // Log transaction
        await supabaseAdmin.from("credit_transactions").insert({
            user_id: user.id,
            credit_type: "image_credits",
            amount: -TRAINING_COST,
            balance_after: newBalance,
            reason: "character_training",
            related_id: characterId,
        });

        // ─── Update character status ───
        await supabaseAdmin
            .from("characters")
            .update({
                model_status: "training",
                training_started_at: new Date().toISOString(),
                training_error: null, // Clear previous error
            })
            .eq("id", characterId);

        // ─── Optional training config from request body ───
        let trainingConfig: Record<string, number> = {};
        try {
            const body = await request.json();
            trainingConfig = {
                num_train_steps: body.num_train_steps,
                learning_rate: body.learning_rate,
                lora_rank: body.lora_rank,
                resolution: body.resolution,
            };
        } catch {
            // No body or invalid JSON — use defaults
        }

        // ─── Start training on Modal ───
        try {
            const result = await startLoraTraining({
                characterId,
                characterName: character.name,
                referenceImageUrls: imageUrls,
                ...trainingConfig,
            });

            if (!result.success) {
                // Modal rejected immediately — refund and reset
                await supabaseAdmin
                    .from("credits")
                    .update({ image_credits: credits.image_credits })
                    .eq("user_id", user.id);

                await supabaseAdmin.from("credit_transactions").insert({
                    user_id: user.id,
                    credit_type: "image_credits",
                    amount: TRAINING_COST,
                    balance_after: credits.image_credits,
                    reason: "training_refund_immediate_failure",
                    related_id: characterId,
                });

                await supabaseAdmin
                    .from("characters")
                    .update({ model_status: "failed", training_error: "Failed to start training" })
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
            // Modal request failed — refund and reset
            console.error("[Train] Modal request failed:", modalError);

            await supabaseAdmin
                .from("credits")
                .update({ image_credits: credits.image_credits })
                .eq("user_id", user.id);

            await supabaseAdmin.from("credit_transactions").insert({
                user_id: user.id,
                credit_type: "image_credits",
                amount: TRAINING_COST,
                balance_after: credits.image_credits,
                reason: "training_refund_modal_error",
                related_id: characterId,
            });

            await supabaseAdmin
                .from("characters")
                .update({
                    model_status: "failed",
                    training_error: modalError instanceof Error ? modalError.message : "Modal request failed",
                })
                .eq("id", characterId);

            return NextResponse.json(
                { error: "Failed to connect to training service" },
                { status: 502 }
            );
        }
    } catch (error) {
        console.error("[Train] Unexpected error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}