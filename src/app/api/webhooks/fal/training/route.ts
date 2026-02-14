import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const characterId = searchParams.get("characterId");
    const secret = searchParams.get("secret");

    if (secret !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!characterId) {
        return NextResponse.json({ error: "Missing characterId" }, { status: 400 });
    }

    try {
        const body = await request.json();
        console.log("[Webhook] Fal training webhook received:", JSON.stringify(body).substring(0, 500));
        console.log("[Webhook] Status:", body.status);
        console.log("[Webhook] Character:", characterId);

        // fal.ai webhooks use "OK" for success, "ERROR" for failure
        if (body.status === "OK") {
            const loraUrl =
                body.payload?.diffusers_lora_file?.url ||
                body.payload?.lora_file?.url ||
                body.payload?.weights?.url ||
                body.payload?.output?.diffusers_lora_file?.url;

            console.log("[Webhook] LoRA URL found:", loraUrl);

            if (loraUrl) {
                await supabaseAdmin
                    .from("characters")
                    .update({
                        status: "trained",
                        lora_url: loraUrl,
                        trained_at: new Date().toISOString(),
                        error_message: null
                    })
                    .eq("id", characterId);

                console.log("[Webhook] Character updated to trained!");
            } else {
                console.error("[Webhook] No LoRA URL found in payload:", JSON.stringify(body.payload));
                await supabaseAdmin
                    .from("characters")
                    .update({
                        status: "failed",
                        error_message: "Training completed but no LoRA URL returned"
                    })
                    .eq("id", characterId);
            }
        } else if (body.status === "ERROR") {
            console.error("[Webhook] Training failed:", body.error);
            await supabaseAdmin
                .from("characters")
                .update({
                    status: "failed",
                    error_message: body.error || "Training failed"
                })
                .eq("id", characterId);
        } else {
            // Log unexpected status for debugging
            console.warn("[Webhook] Unexpected status:", body.status);
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error("[Webhook] Processing error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}