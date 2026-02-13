import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fal } from "@fal-ai/client";
import { deductCredits, addCredits } from "@/lib/services/credits";
import { CREDIT_COSTS } from "@/lib/config/credits";

fal.config({ credentials: process.env.FAL_KEY });

export const runtime = "nodejs";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: characterId } = await params;

    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { data: character } = await supabaseAdmin
            .from("characters")
            .select("*")
            .eq("id", characterId)
            .eq("user_id", user.id)
            .single();

        if (!character) return NextResponse.json({ error: "Character not found" }, { status: 404 });

        const imageUrls = character.image_urls || [];
        if (imageUrls.length < 4) {
            return NextResponse.json({ error: "Not enough images to train" }, { status: 400 });
        }

        try {
            await deductCredits(user.id, "character_training");
        } catch (err: any) {
            return NextResponse.json({ error: err.message, code: "INSUFFICIENT_CREDITS" }, { status: 402 });
        }

        const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/fal/training?characterId=${characterId}&secret=${process.env.SUPABASE_SERVICE_ROLE_KEY}`;

        console.log(`[Train] Starting Fal training for ${characterId} with ${imageUrls.length} images`);

        // fal API accepts this format at runtime, TypeScript types are just outdated
        const result = await fal.queue.submit("fal-ai/flux-lora-fast-training", {
            input: {
                images_data_url: imageUrls.map((url: string) => url),
                trigger_phrase: "ohwx",
                is_style: false,
            } as any,
            webhookUrl,
        });

        await supabaseAdmin
            .from("characters")
            .update({
                status: "training",
                job_id: result.request_id,
                error_message: null
            })
            .eq("id", characterId);

        return NextResponse.json({ success: true, requestId: result.request_id });

    } catch (error: any) {
        console.error("Train error:", error);

        try {
            const supabase = await createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) await addCredits(user.id, CREDIT_COSTS.character_training, "Refund - Training failed");
        } catch (e) { console.error("Refund failed", e); }

        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}