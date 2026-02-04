import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: characterId } = await params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: character } = await supabaseAdmin
            .from("characters")
            .select("*")
            .eq("id", characterId)
            .eq("user_id", user.id)
            .single();

        if (!character) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        // If already done, return immediately
        if (character.status === "ready") {
            return NextResponse.json({
                status: "ready",
                lora_url: character.lora_url,
                trigger_word: character.trigger_word,
            });
        }

        if (character.status === "failed") {
            return NextResponse.json({
                status: "failed",
                error: character.error_message,
            });
        }

        // If training, check FAL status
        if (character.status === "training" && character.job_id) {
            const statusRes = await fetch(
                `https://queue.fal.run/fal-ai/flux-lora-fast-training/requests/${character.job_id}/status`,
                {
                    headers: { "Authorization": `Key ${process.env.FAL_KEY}` },
                }
            );

            const statusData = await statusRes.json();
            console.log("FAL Status:", statusData);

            // Training completed
            if (statusData.status === "COMPLETED") {
                // Get the result
                const resultRes = await fetch(
                    `https://queue.fal.run/fal-ai/flux-lora-fast-training/requests/${character.job_id}`,
                    {
                        headers: { "Authorization": `Key ${process.env.FAL_KEY}` },
                    }
                );
                const resultData = await resultRes.json();
                console.log("FAL Result:", JSON.stringify(resultData, null, 2));

                const loraUrl = resultData.diffusers_lora_file?.url;

                if (loraUrl) {
                    await supabaseAdmin
                        .from("characters")
                        .update({
                            status: "ready",
                            lora_url: loraUrl,
                            trained_at: new Date().toISOString(),
                        })
                        .eq("id", characterId);

                    return NextResponse.json({
                        status: "ready",
                        lora_url: loraUrl,
                        trigger_word: character.trigger_word,
                    });
                }
            }

            // Training failed
            if (statusData.status === "FAILED") {
                await supabaseAdmin
                    .from("characters")
                    .update({
                        status: "failed",
                        error_message: statusData.error || "Training failed",
                    })
                    .eq("id", characterId);

                return NextResponse.json({
                    status: "failed",
                    error: statusData.error || "Training failed",
                });
            }

            // Still processing
            return NextResponse.json({
                status: "training",
                progress: statusData.progress || 0,
                logs: statusData.logs || [],
            });
        }

        return NextResponse.json({ status: character.status });

    } catch (error: any) {
        console.error("Status check error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}