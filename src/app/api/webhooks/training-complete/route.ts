import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        console.log("📞 Training webhook received:", JSON.stringify(body, null, 2));

        const { character_id, status, model_url, trigger_word, error } = body;

        if (!character_id) {
            return NextResponse.json({ error: "Missing character_id" }, { status: 400 });
        }

        if (status === "ready") {
            if (!model_url) {
                console.error("❌ No model_url provided!");
                return NextResponse.json({ error: "No model_url" }, { status: 400 });
            }

            // Save to BOTH lora_url and model_url for compatibility
            const { error: updateError } = await supabaseAdmin
                .from("characters")
                .update({
                    model_status: "ready",
                    model_url: model_url,
                    lora_url: model_url,  // ← ADD THIS!
                    trigger_word: trigger_word,  // ← Save to column too!
                    training_completed_at: new Date().toISOString(),
                    trained_at: new Date().toISOString(),
                    settings: {
                        trigger_word: trigger_word,
                    },
                })
                .eq("id", character_id);

            if (updateError) {
                console.error("❌ Failed to update character:", updateError);
                return NextResponse.json({ error: updateError.message }, { status: 500 });
            }

            console.log("✅ Character ready:", character_id);
            console.log("   LoRA URL:", model_url);
            console.log("   Trigger:", trigger_word);

        } else if (status === "failed") {
            await supabaseAdmin
                .from("characters")
                .update({
                    model_status: "failed",
                    training_error: error || "Training failed",
                })
                .eq("id", character_id);

            console.log("❌ Training failed:", character_id, error);
        }

        return NextResponse.json({ success: true });

    } catch (err) {
        console.error("❌ Webhook error:", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}