import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { enhancePrompt } from "@/lib/services/gemini";
import { deductCredits, addCredits } from "@/lib/services/credits";
import { CREDIT_COSTS } from "@/lib/config/credits";

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const {
            character_id,
            prompt,
            aspect_ratio = "1:1",
            enhance_prompt: shouldEnhance = false,
            num_images = 1,
        } = await req.json();

        if (!character_id) {
            return NextResponse.json({ error: "נא לבחור דמות" }, { status: 400 });
        }

        if (!prompt?.trim()) {
            return NextResponse.json({ error: "נא להזין תיאור לתמונה" }, { status: 400 });
        }

        // Deduct credits upfront
        try {
            await deductCredits(user.id, "image_generation");
        } catch (err) {
            return NextResponse.json(
                { error: (err as Error).message, code: "INSUFFICIENT_CREDITS" },
                { status: 402 }
            );
        }

        // Fetch character
        const { data: character, error: charError } = await supabase
            .from("characters")
            .select("*")
            .eq("id", character_id)
            .eq("user_id", user.id)
            .single();

        if (charError || !character) {
            await addCredits(user.id, CREDIT_COSTS.image_generation, "החזר - דמות לא נמצאה");
            return NextResponse.json({ error: "דמות לא נמצאה" }, { status: 404 });
        }

        if (!character.lora_url) {
            await addCredits(user.id, CREDIT_COSTS.image_generation, "החזר - דמות לא מאומנת");
            return NextResponse.json({ error: "הדמות עדיין לא מאומנת" }, { status: 400 });
        }

        // Enhance prompt if requested
        let finalPrompt = prompt;
        if (shouldEnhance) {
            try { finalPrompt = await enhancePrompt(prompt, "image"); } catch { }
        }

        const fullPrompt = character.trigger_word
            ? `${character.trigger_word}, ${finalPrompt}`
            : finalPrompt;

        // Create job with params for polling endpoint
        const jobId = nanoid();
        await supabaseAdmin.from("jobs").insert({
            id: jobId,
            user_id: user.id,
            type: "character_image",
            status: "processing",
            progress: 10,
            result: {
                params: {
                    fullPrompt,
                    loraUrl: character.lora_url,
                    aspectRatio: aspect_ratio,
                    numImages: Math.min(num_images, 4),
                    characterId: character.id,
                },
            },
        });

        // Return immediately — polling endpoint will do the work
        return NextResponse.json({ jobId });
    } catch (error: any) {
        console.error("Character image error:", error);
        return NextResponse.json(
            { error: error.message || "שגיאה ביצירת התמונה" },
            { status: 500 }
        );
    }
}