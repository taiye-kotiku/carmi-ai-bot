import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fal } from "@fal-ai/client";
import { deductCredits, addCredits } from "@/lib/services/credits";
import { createImagesZip } from "@/lib/services/fal";
import { CREDIT_COSTS } from "@/lib/config/credits";

fal.config({ credentials: process.env.FAL_KEY });

export const runtime = "nodejs";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: characterId } = await params;

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Get character
        const { data: character } = await supabaseAdmin
            .from("characters")
            .select("*")
            .eq("id", characterId)
            .eq("user_id", user.id)
            .single();

        if (!character) return NextResponse.json({ error: "Character not found" }, { status: 404 });

        // If already training/ready, ignore
        if (character.status === "training" || character.status === "ready") {
            return NextResponse.json({ message: "Already training or ready" });
        }

        const imageUrls = character.image_urls || [];
        if (imageUrls.length < 4) {
            return NextResponse.json({ error: "At least 4 images required" }, { status: 400 });
        }

        // Deduct credits
        try {
            await deductCredits(user.id, "character_training");
        } catch (err: any) {
            return NextResponse.json({ error: err.message, code: "INSUFFICIENT_CREDITS" }, { status: 402 });
        }

        // Update status
        await supabaseAdmin
            .from("characters")
            .update({
                status: "training",
                training_started_at: new Date().toISOString(),
                error_message: null,
            })
            .eq("id", characterId);

        console.log(`[Train] Starting FAL training for ${characterId}`);

        try {
            // DIRECT URL METHOD (No ZIP needed - much faster)
            const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/fal/training?characterId=${characterId}&secret=${process.env.SUPABASE_SERVICE_ROLE_KEY}`;

            // Note: Use fal.queue directly
            const imagesZip = await createImagesZip(imageUrls);

            const result = await fal.queue.submit("fal-ai/flux-lora-fast-training", {
                input: {
                    // Send ZIP blob directly
                    images_data_url: imagesZip,
                    trigger_word: "ohwx",
                    is_style: false
                },
                webhookUrl
            });

            console.log(`[Train] FAL request_id: ${result.request_id}`);

            // Save request ID
            await supabaseAdmin
                .from("characters")
                .update({
                    job_id: result.request_id,
                    trigger_word: "ohwx",
                })
                .eq("id", characterId);

            return NextResponse.json({
                success: true,
                requestId: result.request_id,
            });

        } catch (falError: any) {
            console.error("[Train] FAL error:", falError);

            await addCredits(user.id, CREDIT_COSTS.character_training, "Refund - Training failed");
            await supabaseAdmin.from("characters").update({ status: "failed", error_message: falError.message }).eq("id", characterId);

            return NextResponse.json({ error: falError.message }, { status: 500 });
        }

    } catch (error: any) {
        console.error("[Train] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}