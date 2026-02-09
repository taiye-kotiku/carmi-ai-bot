// src/app/api/characters/[id]/image/route.ts
export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateWithLora } from "@/lib/services/modal";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id: characterId } = await params;

        // Fetch character
        const { data: character, error: fetchError } = await supabaseAdmin
            .from("characters")
            .select("*")
            .eq("id", characterId)
            .eq("user_id", user.id)
            .single();

        if (fetchError || !character) {
            return NextResponse.json({ error: "Character not found" }, { status: 404 });
        }

        if (character.status !== "ready") {
            return NextResponse.json(
                { error: `Character not ready. Status: ${character.status}` },
                { status: 400 }
            );
        }

        if (!character.lora_url) {
            return NextResponse.json(
                { error: "Character has no trained model" },
                { status: 400 }
            );
        }

        // Parse request
        const body = await request.json();
        const {
            prompt,
            width = 1024,
            height = 1024,
            num_inference_steps = 28,
            guidance_scale = 3.5,
            lora_scale = 0.85,
        } = body;

        if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
            return NextResponse.json({ error: "prompt is required" }, { status: 400 });
        }

        // Check credits
        const GENERATION_COST = 1;
        const { data: credits } = await supabaseAdmin
            .from("credits")
            .select("image_credits")
            .eq("user_id", user.id)
            .single();

        if (!credits || credits.image_credits < GENERATION_COST) {
            return NextResponse.json(
                { error: `Insufficient credits. Need ${GENERATION_COST}, have ${credits?.image_credits ?? 0}` },
                { status: 402 }
            );
        }

        // Deduct credits
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

        const triggerWord = character.trigger_word || "TOK";

        console.log(`[CharacterImage] Character: ${character.name}`);
        console.log(`[CharacterImage] LoRA: ${character.lora_url}`);
        console.log(`[CharacterImage] Prompt: ${prompt}`);

        try {
            // Generate with Modal
            const result = await generateWithLora({
                prompt: prompt.trim(),
                modelUrl: character.lora_url,
                triggerWord: triggerWord,
                width,
                height,
                numInferenceSteps: num_inference_steps,
                guidanceScale: guidance_scale,
                loraScale: lora_scale,
            });

            if (!result.success) {
                throw new Error(result.error || "Generation failed");
            }

            const imageUrl = result.image_url;

            if (!imageUrl) {
                throw new Error("No image URL returned");
            }

            // Save generation record
            const generationId = crypto.randomUUID();
            await supabaseAdmin.from("generations").insert({
                id: generationId,
                user_id: user.id,
                type: "image",
                feature: "character_image",
                prompt: prompt.trim(),
                result_urls: [imageUrl],
                status: "completed",
            });

            return NextResponse.json({
                success: true,
                image_url: imageUrl,
                seed: result.seed,
                generation_id: generationId,
            });

        } catch (genError: any) {
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
                { error: genError.message || "Modal generation failed" },
                { status: 502 }
            );
        }

    } catch (error: any) {
        console.error("[CharacterImage] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}