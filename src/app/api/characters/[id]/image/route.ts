// src/app/api/characters/[id]/image/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateWithLora } from "@/lib/services/modal";

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

        // ─── Fetch character ───
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

        if (character.model_status !== "ready") {
            return NextResponse.json(
                {
                    error: `Character is not ready. Current status: ${character.model_status}`,
                },
                { status: 400 }
            );
        }

        if (!character.model_url) {
            return NextResponse.json(
                { error: "Character has no trained model" },
                { status: 400 }
            );
        }

        // ─── Parse request ───
        const body = await request.json();
        const {
            prompt,
            negative_prompt,
            width = 1024,
            height = 1024,
            num_inference_steps = 28,
            guidance_scale = 3.5,
            seed = -1,
            lora_scale = 0.85,
        } = body;

        if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
            return NextResponse.json(
                { error: "prompt is required" },
                { status: 400 }
            );
        }

        // ─── Check credits ───
        const GENERATION_COST = 1;
        const { data: credits } = await supabaseAdmin
            .from("credits")
            .select("image_credits")
            .eq("user_id", user.id)
            .single();

        if (!credits || credits.image_credits < GENERATION_COST) {
            return NextResponse.json(
                {
                    error: `Insufficient credits. Generation costs ${GENERATION_COST} image credit. You have ${credits?.image_credits ?? 0}.`,
                },
                { status: 402 }
            );
        }

        // ─── Deduct credits ───
        const newBalance = credits.image_credits - GENERATION_COST;
        await supabaseAdmin
            .from("credits")
            .update({ image_credits: newBalance })
            .eq("user_id", user.id);

        await supabaseAdmin.from("credit_transactions").insert({
            user_id: user.id,
            credit_type: "image_credits",
            amount: -GENERATION_COST,
            balance_after: newBalance,
            reason: "character_image_generation",
            related_id: characterId,
        });

        // ─── Generate ───
        const triggerWord = character.settings?.trigger_word || "TOK";

        try {
            const result = await generateWithLora({
                prompt: prompt.trim(),
                modelUrl: character.model_url,
                triggerWord,
                negativePrompt: negative_prompt,
                numInferenceSteps: num_inference_steps,
                guidanceScale: guidance_scale,
                width,
                height,
                seed,
                loraScale: lora_scale,
            });

            if (!result.success || !result.image_url) {
                // Refund on failure
                await supabaseAdmin
                    .from("credits")
                    .update({ image_credits: credits.image_credits })
                    .eq("user_id", user.id);

                await supabaseAdmin.from("credit_transactions").insert({
                    user_id: user.id,
                    credit_type: "image_credits",
                    amount: GENERATION_COST,
                    balance_after: credits.image_credits,
                    reason: "generation_refund",
                    related_id: characterId,
                });

                return NextResponse.json(
                    { error: result.error || "Generation failed" },
                    { status: 500 }
                );
            }

            // ─── Save generation record ───
            const generationId = crypto.randomUUID();
            await supabaseAdmin.from("generations").insert({
                id: generationId,
                user_id: user.id,
                type: "image",
                feature: "character_image",
                prompt: prompt.trim(),
                result_urls: [result.image_url],
                thumbnail_url: result.image_url,
                width,
                height,
                status: "completed",
                completed_at: new Date().toISOString(),
            });

            return NextResponse.json({
                success: true,
                image_url: result.image_url,
                seed: result.seed,
                generation_id: generationId,
            });
        } catch (genError) {
            console.error("[CharacterImage] Generation error:", genError);

            // Refund credits
            await supabaseAdmin
                .from("credits")
                .update({ image_credits: credits.image_credits })
                .eq("user_id", user.id);

            await supabaseAdmin.from("credit_transactions").insert({
                user_id: user.id,
                credit_type: "image_credits",
                amount: GENERATION_COST,
                balance_after: credits.image_credits,
                reason: "generation_refund_error",
                related_id: characterId,
            });

            return NextResponse.json(
                { error: "Generation service error" },
                { status: 502 }
            );
        }
    } catch (error) {
        console.error("[CharacterImage] Unexpected error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}