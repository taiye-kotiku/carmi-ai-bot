import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: characterId } = await params;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: character } = await supabaseAdmin
        .from("characters")
        .select("status, lora_url, error_message, job_id")
        .eq("id", characterId)
        .eq("user_id", user.id)
        .single();

    if (!character) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // If still training, check FAL status
    if (character.status === "training" && character.job_id) {
        try {
            const res = await fetch(
                `https://queue.fal.run/fal-ai/flux-lora-fast-training/requests/${character.job_id}/status`,
                { headers: { "Authorization": `Key ${process.env.FAL_KEY}` } }
            );
            const falStatus = await res.json();

            if (falStatus.status === "COMPLETED") {
                // Get result
                const resultRes = await fetch(
                    `https://queue.fal.run/fal-ai/flux-lora-fast-training/requests/${character.job_id}`,
                    { headers: { "Authorization": `Key ${process.env.FAL_KEY}` } }
                );
                const result = await resultRes.json();

                if (result.diffusers_lora_file?.url) {
                    await supabaseAdmin
                        .from("characters")
                        .update({
                            status: "ready",
                            lora_url: result.diffusers_lora_file.url,
                            trained_at: new Date().toISOString(),
                        })
                        .eq("id", characterId);

                    return NextResponse.json({ status: "ready", lora_url: result.diffusers_lora_file.url });
                }
            }

            if (falStatus.status === "FAILED") {
                await supabaseAdmin
                    .from("characters")
                    .update({ status: "failed" })
                    .eq("id", characterId);
                return NextResponse.json({ status: "failed" });
            }

            return NextResponse.json({ status: "training", progress: falStatus.progress || 0 });

        } catch (e) {
            console.error("Status check error:", e);
        }
    }

    return NextResponse.json({
        status: character.status,
        lora_url: character.lora_url,
        error: character.error_message,
    });
}