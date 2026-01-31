import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        console.log("📞 Training webhook received:", body);

        const { character_id, status, model_url, trigger_word, error } = body;

        if (!character_id) {
            return NextResponse.json({ error: "Missing character_id" }, { status: 400 });
        }

        if (status === "ready") {
            // Training succeeded - update character
            const { error: updateError } = await supabase
                .from("characters")
                .update({
                    status: "ready",
                    lora_url: model_url,
                    trigger_word: trigger_word,
                    trained_at: new Date().toISOString(),
                })
                .eq("id", character_id);

            if (updateError) {
                console.error("❌ Failed to update character:", updateError);
                return NextResponse.json({ error: updateError.message }, { status: 500 });
            }

            console.log("✅ Character updated to ready:", character_id);

        } else if (status === "failed") {
            // Training failed - update status
            const { error: updateError } = await supabase
                .from("characters")
                .update({
                    status: "failed",
                    error_message: error || "Training failed",
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