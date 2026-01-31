import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        console.log("📞 Training webhook received:", body);

        const { character_id, status, model_url, trigger_word, error } = body;

        if (!character_id) {
            return NextResponse.json({ error: "Missing character_id" }, { status: 400 });
        }

        if (status === "ready") {
            // Training succeeded
            const { error: updateError } = await supabaseAdmin
                .from("characters")
                .update({
                    model_status: "ready",
                    model_url: model_url,
                    training_completed_at: new Date().toISOString(),
                    settings: {
                        trigger_word: trigger_word,
                    },
                })
                .eq("id", character_id);

            if (updateError) {
                console.error("❌ Failed to update character:", updateError);
                return NextResponse.json({ error: updateError.message }, { status: 500 });
            }

            console.log("✅ Character updated to ready:", character_id);

        } else if (status === "failed") {
            // Training failed
            const { error: updateError } = await supabaseAdmin
                .from("characters")
                .update({
                    model_status: "failed",
                    training_error: error || "Training failed",
                })
                .eq("id", character_id);

            if (updateError) {
                console.error("❌ Failed to update character:", updateError);
            }

            console.log("❌ Character training failed:", character_id, error);
        }

        return NextResponse.json({ success: true });

    } catch (err) {
        console.error("❌ Webhook error:", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}