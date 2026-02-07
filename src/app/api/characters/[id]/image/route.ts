// src/app/api/characters/[id]/image/route.ts
export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fal } from "@fal-ai/client";
import { nanoid } from "nanoid";

fal.config({ credentials: process.env.FAL_KEY });

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

        if (character.status !== "ready") {
            return NextResponse.json(
                {
                    error: `Character is not ready. Current status: ${character.status}`,
                },
                { status: 400 }
            );
        }

        if (!character.lora_url) {
            return NextResponse.json(
                { error: "Character has no trained model" },
                { status: 400 }
            );
        }

        // ─── Parse request ───
        const body = await request.json();
        const {
            prompt,
            width = 1024,
            height = 1024,
            num_inference_steps = 28,
            guidance_scale = 3.5,
            lora_scale = 0.9,
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

        // ─── Generate with Fal.ai flux-lora ───
        const triggerWord = character.trigger_word || "TOK";
        const fullPrompt = `${triggerWord}, ${prompt.trim()}`;

        // Map dimensions to Fal.ai image_size
        type ImageSize = "square" | "square_hd" | "portrait_4_3" | "portrait_16_9" | "landscape_4_3" | "landscape_16_9";
        let imageSize: ImageSize = "square";
        if (width === height) {
            imageSize = width >= 1024 ? "square_hd" : "square";
        } else if (width > height) {
            const ratio = width / height;
            imageSize = ratio > 1.5 ? "landscape_16_9" : "landscape_4_3";
        } else {
            const ratio = height / width;
            imageSize = ratio > 1.5 ? "portrait_16_9" : "portrait_4_3";
        }

        try {
            const result = await fal.subscribe("fal-ai/flux-lora", {
                input: {
                    prompt: fullPrompt,
                    loras: [{ path: character.lora_url, scale: lora_scale }],
                    image_size: imageSize,
                    num_images: 1,
                    output_format: "jpeg",
                    guidance_scale: guidance_scale,
                    num_inference_steps: num_inference_steps,
                    enable_safety_checker: false,
                },
                logs: true,
            });

            const imageUrl = result.data.images?.[0]?.url;
            if (!imageUrl) {
                throw new Error("No image generated");
            }

            // ─── Save generation record ───
            const generationId = nanoid();
            await supabaseAdmin.from("generations").insert({
                id: generationId,
                user_id: user.id,
                type: "image",
                feature: "character_image",
                prompt: prompt.trim(),
                result_urls: [imageUrl],
                thumbnail_url: imageUrl,
                width,
                height,
                status: "completed",
                completed_at: new Date().toISOString(),
            });

            return NextResponse.json({
                success: true,
                image_url: imageUrl,
                seed: result.data.seed,
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
                { error: genError.message || "Generation service error" },
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