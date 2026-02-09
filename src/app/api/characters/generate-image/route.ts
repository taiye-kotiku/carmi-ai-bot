// src/app/api/characters/generate-image/route.ts
export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateWithLora } from "@/lib/services/modal";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { characterId, prompt, aspectRatio = "1:1" } = await request.json();

        if (!characterId) {
            return NextResponse.json({ error: "characterId is required" }, { status: 400 });
        }

        if (!prompt) {
            return NextResponse.json({ error: "prompt is required" }, { status: 400 });
        }

        // Get character with LoRA
        const { data: character, error: charError } = await supabaseAdmin
            .from("characters")
            .select("*")
            .eq("id", characterId)
            .eq("user_id", user.id)
            .single();

        if (charError || !character) {
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
                { error: "Character not trained yet - no LoRA URL" },
                { status: 400 }
            );
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

        // Calculate dimensions based on aspect ratio
        let width = 1024;
        let height = 1024;
        if (aspectRatio === "9:16") {
            width = 768;
            height = 1344;
        } else if (aspectRatio === "16:9") {
            width = 1344;
            height = 768;
        } else if (aspectRatio === "4:5") {
            width = 896;
            height = 1120;
        }

        const triggerWord = character.trigger_word || "TOK";

        console.log("[Generate] Using MODAL for inference");
        console.log("[Generate] Character:", character.name);
        console.log("[Generate] LoRA URL:", character.lora_url);
        console.log("[Generate] Trigger:", triggerWord);
        console.log("[Generate] Prompt:", prompt);
        console.log("[Generate] Size:", width, "x", height);

        try {
            // Generate with MODAL (not FAL!)
            const result = await generateWithLora({
                prompt: prompt,
                modelUrl: character.lora_url,
                triggerWord: triggerWord,
                width,
                height,
                numInferenceSteps: 28,
                guidanceScale: 3.5,
                loraScale: 0.85,
            });

            console.log("[Generate] Modal result:", JSON.stringify(result));

            if (!result.success) {
                throw new Error(result.error || "Modal generation failed");
            }

            // Modal returns image_url (uploaded to Supabase) or image_base64
            let imageUrl = result.image_url;

            // If Modal returned base64, we need to upload it
            if (!imageUrl && result.image_base64) {
                console.log("[Generate] Got base64, uploading to Supabase...");

                const buffer = Buffer.from(result.image_base64, "base64");
                const fileName = `${crypto.randomUUID()}.png`;
                const filePath = `generations/${fileName}`;

                const { error: uploadError } = await supabaseAdmin.storage
                    .from("generations")
                    .upload(filePath, buffer, {
                        contentType: "image/png",
                        upsert: true,
                    });

                if (uploadError) {
                    console.error("[Generate] Upload error:", uploadError);
                    throw new Error("Failed to upload generated image");
                }

                const { data: { publicUrl } } = supabaseAdmin.storage
                    .from("generations")
                    .getPublicUrl(filePath);

                imageUrl = publicUrl;
            }

            if (!imageUrl) {
                throw new Error("No image URL returned from Modal");
            }

            // Save to generations table
            const generationId = crypto.randomUUID();
            await supabaseAdmin.from("generations").insert({
                id: generationId,
                user_id: user.id,
                type: "image",
                feature: "character_image",
                prompt: `${triggerWord} ${prompt}`,
                result_urls: [imageUrl],
                status: "completed",
            });

            console.log("[Generate] Success! Image:", imageUrl);

            return NextResponse.json({
                success: true,
                imageUrl,
                seed: result.seed,
                generationId,
            });

        } catch (genError: any) {
            console.error("[Generate] Modal error:", genError);

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
        console.error("[Generate] Error:", error);
        return NextResponse.json(
            { error: error.message || "Generation failed" },
            { status: 500 }
        );
    }
}