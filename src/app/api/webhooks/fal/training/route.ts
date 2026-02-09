// src/app/api/webhooks/fal/training/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        console.log("[FAL Webhook] Received:", JSON.stringify(body, null, 2));

        const { request_id, status, payload, error } = body;

        if (!request_id) {
            return NextResponse.json({ error: "No request_id" }, { status: 400 });
        }

        // Find character by job_id
        const { data: character, error: findError } = await supabaseAdmin
            .from("characters")
            .select("*")
            .eq("job_id", request_id)
            .single();

        if (findError || !character) {
            console.error("[FAL Webhook] Character not found for:", request_id);
            return NextResponse.json({ error: "Character not found" }, { status: 404 });
        }

        console.log(`[FAL Webhook] Character: ${character.id}, Status: ${status}`);

        if (status === "COMPLETED" || status === "OK") {
            // FAL returns diffusers_lora_file with url
            const loraUrl = payload?.diffusers_lora_file?.url;

            if (loraUrl) {
                await supabaseAdmin
                    .from("characters")
                    .update({
                        status: "ready",
                        lora_url: loraUrl,
                        trained_at: new Date().toISOString(),
                        error_message: null,
                    })
                    .eq("id", character.id);

                console.log(`[FAL Webhook] Training completed!`);
                console.log(`[FAL Webhook] LoRA URL: ${loraUrl}`);
            } else {
                console.error("[FAL Webhook] No LoRA URL in payload:", payload);
                await supabaseAdmin
                    .from("characters")
                    .update({
                        status: "failed",
                        error_message: "No LoRA URL returned from FAL",
                    })
                    .eq("id", character.id);
            }

        } else if (status === "FAILED" || status === "ERROR") {
            const errorMsg = error || payload?.error || "Training failed";

            await supabaseAdmin
                .from("characters")
                .update({
                    status: "failed",
                    error_message: errorMsg,
                })
                .eq("id", character.id);

            console.error(`[FAL Webhook] Training failed:`, errorMsg);
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("[FAL Webhook] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}