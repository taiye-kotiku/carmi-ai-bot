import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const characterId = searchParams.get("characterId");
    const secret = searchParams.get("secret");

    // Simple security check
    if (secret !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!characterId) {
        return NextResponse.json({ error: "Missing characterId" }, { status: 400 });
    }

    try {
        const body = await request.json();
        console.log("Fal Webhook:", body);

        if (body.status === "COMPLETED") {
            // Get the LoRA URL
            // Result format depends on the model. For flux-lora-fast-training:
            // payload: { diffusers_lora_file: { url: "..." }, config_file: ... }
            const loraUrl = body.payload?.diffusers_lora_file?.url;

            if (loraUrl) {
                await supabaseAdmin
                    .from("characters")
                    .update({
                        status: "ready",
                        lora_url: loraUrl,
                        trained_at: new Date().toISOString()
                    })
                    .eq("id", characterId);
            } else {
                console.error("No LoRA URL in payload", body);
                await supabaseAdmin.from("characters").update({ status: "failed" }).eq("id", characterId);
            }
        } else if (body.status === "FAILED") {
            await supabaseAdmin
                .from("characters")
                .update({ status: "failed", error_message: body.error || "Training failed" })
                .eq("id", characterId);
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error("Webhook processing error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}