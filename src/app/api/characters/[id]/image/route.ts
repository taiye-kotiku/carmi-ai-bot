export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateWithLora } from "@/lib/services/modal";
import { enhancePrompt } from "@/lib/services/prompt-enhancer";
import { deductCredits, addCredits } from "@/lib/services/credits";
import { CREDIT_COSTS } from "@/lib/config/credits";

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

        // Deduct credits upfront
        try {
            await deductCredits(user.id, "image_generation");
        } catch (err) {
            return NextResponse.json(
                {
                    error: (err as Error).message,
                    code: "INSUFFICIENT_CREDITS",
                },
                { status: 402 }
            );
        }

        const triggerWord = character.trigger_word || "ohwx";

        // ✅ Enhance prompt: translate Hebrew + add quality keywords
        let enhancedPrompt: string;
        try {
            enhancedPrompt = await enhancePrompt(prompt.trim());
        } catch (e) {
            console.warn("[CharacterImage] Enhancement failed, using original:", e);
            enhancedPrompt = prompt.trim();
        }

        // Prepend trigger word if not already present
        let finalPrompt = enhancedPrompt;
        if (!finalPrompt.toLowerCase().includes(triggerWord.toLowerCase())) {
            finalPrompt = `${triggerWord} person, ${finalPrompt}`;
        }

        console.log(`[CharacterImage] Character: ${character.name}`);
        console.log(`[CharacterImage] Original prompt: "${prompt}"`);
        console.log(`[CharacterImage] Enhanced prompt: "${enhancedPrompt}"`);
        console.log(`[CharacterImage] Final prompt:    "${finalPrompt}"`);

        try {
            const result = await generateWithLora({
                prompt: finalPrompt,
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
                prompt: finalPrompt,
                result_urls: [imageUrl],
                status: "completed",
            });

            return NextResponse.json({
                success: true,
                image_url: imageUrl,
                seed: result.seed,
                generation_id: generationId,
                enhanced_prompt: enhancedPrompt,
            });

        } catch (genError: any) {
            console.error("[CharacterImage] Generation error:", genError);

            await addCredits(
                user.id,
                CREDIT_COSTS.image_generation,
                "החזר - יצירת תמונת דמות נכשלה",
                characterId
            );

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