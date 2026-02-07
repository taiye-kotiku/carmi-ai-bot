import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        console.log("FAL Training Webhook:", JSON.stringify(body, null, 2));

        const { request_id, status, payload } = body;

        if (!request_id) {
            return NextResponse.json({ error: "No request_id" }, { status: 400 });
        }

        // Find character by job_id
        const { data: character } = await supabaseAdmin
            .from("characters")
            .select("*")
            .eq("job_id" as any, request_id)
            .single();


        if (!character) {
            console.log("Character not found for request_id:", request_id);
            return NextResponse.json({ error: "Character not found" }, { status: 404 });
        }

        if (status === "OK" && payload?.diffusers_lora_file?.url) {
            // Training completed
            await supabaseAdmin
                .from("characters")
                .update({
                    status: "ready",
                    lora_url: payload.diffusers_lora_file.url,
                    trained_at: new Date().toISOString(),
                })
                .eq("id", character.id);


            console.log("Training completed for:", character.id);
        } else if (status === "ERROR") {
            await supabaseAdmin
                .from("characters")
                .update({
                    status: "failed",
                    error_message: payload?.error || "Training failed",
                })
                .eq("id", character.id);


            console.log("Training failed for:", character.id);
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Webhook error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}