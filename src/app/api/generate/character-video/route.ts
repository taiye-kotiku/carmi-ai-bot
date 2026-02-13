import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { deductCredits, addCredits } from "@/lib/services/credits";
import { CREDIT_COSTS } from "@/lib/config/credits";

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const {
            character_id,
            topic,
            custom_scenes,
            scene_count = 5,
            style = "storytelling",
            aspect_ratio = "9:16",
            transition_style = "fade",
            scene_duration = 4,
        } = body;

        if (!character_id) {
            return NextResponse.json({ error: "נא לבחור דמות" }, { status: 400 });
        }

        if (!topic && !custom_scenes?.length) {
            return NextResponse.json({ error: "נא להזין נושא או סצנות" }, { status: 400 });
        }

        // Get character
        const { data: character, error: charError } = await supabaseAdmin
            .from("characters")
            .select("*")
            .eq("id", character_id)
            .eq("user_id", user.id)
            .single();

        if (charError || !character) {
            return NextResponse.json({ error: "דמות לא נמצאה" }, { status: 404 });
        }

        if (character.status !== "ready" || !character.lora_url) {
            return NextResponse.json(
                { error: "הדמות עדיין לא מוכנה. נא לאמן אותה קודם." },
                { status: 400 }
            );
        }

        // Deduct credits
        try {
            await deductCredits(user.id, "video_generation");
        } catch (err) {
            return NextResponse.json(
                { error: (err as Error).message, code: "INSUFFICIENT_CREDITS" },
                { status: 402 }
            );
        }

        // Create job with ALL params — polling endpoint handles the rest
        const jobId = nanoid();
        await supabaseAdmin.from("jobs").insert({
            id: jobId,
            user_id: user.id,
            type: "character_video",
            status: "processing",
            progress: 5,
            result: {
                params: {
                    characterId: character.id,
                    characterName: character.name,
                    characterDescription: character.description,
                    loraUrl: character.lora_url,
                    triggerWord: character.trigger_word,
                    loraScale: 1.0,
                    topic,
                    customScenes: custom_scenes,
                    sceneCount: scene_count,
                    style,
                    aspectRatio: aspect_ratio,
                    transitionStyle: transition_style,
                    sceneDuration: scene_duration,
                },
            },
        });

        return NextResponse.json({ jobId });
    } catch (error) {
        console.error("Character video error:", error);
        return NextResponse.json({ error: "שגיאה בשרת" }, { status: 500 });
    }
}