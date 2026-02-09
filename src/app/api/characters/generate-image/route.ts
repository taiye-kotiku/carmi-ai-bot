// src/app/api/characters/generate-image/route.ts
export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateWithLora } from "@/lib/services/modal";
import { enhancePrompt } from "@/lib/services/prompt-enhancer"; // <--- IMPORT THIS

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const {
            characterId,
            prompt,
            aspectRatio = "1:1",
            loraScale = 1.0,
            numInferenceSteps = 28,
            guidanceScale = 3.5,
        } = body;

        if (!characterId || !prompt) {
            return NextResponse.json(
                { error: "characterId and prompt are required" },
                { status: 400 }
            );
        }

        // --- STEP 1: Translate/Enhance Prompt ---
        // This runs in parallel with fetching character data to save time
        const [enhancedPrompt, charResult] = await Promise.all([
            enhancePrompt(prompt),
            supabaseAdmin
                .from("characters")
                .select("*")
                .eq("id", characterId)
                .eq("user_id", user.id)
                .single()
        ]);

        const { data: character, error: charError } = charResult;

        if (charError || !character) {
            return NextResponse.json({ error: "Character not found" }, { status: 404 });
        }

        if (character.status !== "ready" || !character.lora_url) {
            return NextResponse.json(
                { error: `Character not ready. Status: ${character.status}` },
                { status: 400 }
            );
        }

        // --- Check Credits ---
        const GENERATION_COST = 1;
        const { data: credits } = await supabaseAdmin
            .from("credits")
            .select("image_credits")
            .eq("user_id", user.id)
            .single();

        if (!credits || credits.image_credits < GENERATION_COST) {
            return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
        }

        // Deduct credits
        await supabaseAdmin
            .from("credits")
            .update({ image_credits: credits.image_credits - GENERATION_COST })
            .eq("user_id", user.id);

        // --- Prepare Generation ---
        // Calculate dimensions
        let width = 1024, height = 1024;
        if (aspectRatio === "9:16") { width = 768; height = 1344; }
        else if (aspectRatio === "16:9") { width = 1344; height = 768; }
        else if (aspectRatio === "4:5") { width = 896; height = 1120; }

        const triggerWord = character.trigger_word || "ohwx";

        // Combine Trigger + Enhanced Prompt
        // Note: prompt-enhancer is told NOT to add the trigger word
        let finalPrompt = enhancedPrompt;
        if (!finalPrompt.toLowerCase().includes(triggerWord.toLowerCase())) {
            finalPrompt = `${triggerWord} person, ${finalPrompt}`;
        }

        console.log(`[Generate] Original: "${prompt}"`);
        console.log(`[Generate] Final:    "${finalPrompt}"`);

        try {
            // Generate with Modal
            const result = await generateWithLora({
                prompt: finalPrompt,
                modelUrl: character.lora_url,
                triggerWord: triggerWord,
                width,
                height,
                numInferenceSteps,
                guidanceScale,
                loraScale: Math.min(loraScale, 1.5),
            });

            if (!result.success || !result.image_url) {
                throw new Error(result.error || "Generation failed");
            }

            const imageUrl = result.image_url;

            // Save generation
            const generationId = crypto.randomUUID();
            await supabaseAdmin.from("generations").insert({
                id: generationId,
                user_id: user.id,
                type: "image",
                feature: "character_image",
                prompt: finalPrompt, // Save the English prompt for debugging
                // original_prompt: prompt, // REMOVED: Column does not exist in database/types
                result_urls: [imageUrl],
                status: "completed",
            });

            return NextResponse.json({
                success: true,
                imageUrl,
                seed: result.seed,
                generationId,
                translatedPrompt: enhancedPrompt // Return this so UI can show it if needed
            });

        } catch (genError: any) {
            console.error("[Generate] Error:", genError);

            // Refund credits on failure
            await supabaseAdmin
                .from("credits")
                .update({ image_credits: credits.image_credits })
                .eq("user_id", user.id);

            return NextResponse.json(
                { error: genError.message || "Generation failed" },
                { status: 502 }
            );
        }

    } catch (error: any) {
        console.error("[Generate] Unexpected:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}