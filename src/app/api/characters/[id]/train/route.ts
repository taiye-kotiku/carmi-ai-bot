// src/app/api/characters/[id]/train/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fal } from "@fal-ai/client";
import JSZip from "jszip";

fal.config({ credentials: process.env.FAL_KEY });

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
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

        // Get character
        const { data: character, error: charError } = await supabaseAdmin
            .from("characters")
            .select("*")
            .eq("id", characterId)
            .eq("user_id", user.id)
            .single();

        if (charError || !character) {
            return NextResponse.json({ error: "Character not found" }, { status: 404 });
        }

        if (character.status === "training") {
            return NextResponse.json({ error: "Already training" }, { status: 400 });
        }

        if (character.status === "ready" && character.lora_url) {
            return NextResponse.json({ error: "Already trained" }, { status: 400 });
        }

        const imageUrls = character.image_urls || [];
        if (imageUrls.length < 4) {
            return NextResponse.json(
                { error: `Need at least 4 images. Got ${imageUrls.length}` },
                { status: 400 }
            );
        }

        // Check credits
        const TRAINING_COST = 50;
        const { data: credits } = await supabaseAdmin
            .from("credits")
            .select("image_credits")
            .eq("user_id", user.id)
            .single();

        if (!credits || credits.image_credits < TRAINING_COST) {
            return NextResponse.json(
                { error: `Need ${TRAINING_COST} credits. You have ${credits?.image_credits || 0}` },
                { status: 402 }
            );
        }

        // Deduct credits
        await supabaseAdmin
            .from("credits")
            .update({ image_credits: credits.image_credits - TRAINING_COST })
            .eq("user_id", user.id);

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
        console.log(`[Train] Images: ${imageUrls.length}`);

        const triggerWord = "ohwx";

        try {
            // Create ZIP archive with images
            console.log("[Train] Creating ZIP archive...");
            const zip = new JSZip();

            for (let i = 0; i < imageUrls.length; i++) {
                try {
                    const response = await fetch(imageUrls[i]);
                    if (!response.ok) continue;

                    const buffer = await response.arrayBuffer();
                    const ext = imageUrls[i].split('.').pop()?.toLowerCase() || 'jpg';
                    zip.file(`image_${i.toString().padStart(3, '0')}.${ext}`, buffer);

                    console.log(`[Train] Added image ${i + 1}/${imageUrls.length}`);
                } catch (e) {
                    console.error(`[Train] Failed to fetch image ${i}:`, e);
                }
            }

            // Generate ZIP
            const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
            console.log(`[Train] ZIP created: ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB`);

            // Upload ZIP to Supabase
            const zipFileName = `${characterId}/training_images.zip`;
            const { error: uploadError } = await supabaseAdmin.storage
                .from("training")
                .upload(zipFileName, zipBuffer, {
                    contentType: "application/zip",
                    upsert: true,
                });

            if (uploadError) {
                // Try creating bucket
                await supabaseAdmin.storage.createBucket("training", { public: true });
                await supabaseAdmin.storage
                    .from("training")
                    .upload(zipFileName, zipBuffer, {
                        contentType: "application/zip",
                        upsert: true,
                    });
            }

            const { data: { publicUrl: zipUrl } } = supabaseAdmin.storage
                .from("training")
                .getPublicUrl(zipFileName);

            console.log(`[Train] ZIP uploaded: ${zipUrl}`);

            // Start FAL training
            const { request_id } = await fal.queue.submit("fal-ai/flux-lora-fast-training", {
                input: {
                    images_data_url: zipUrl,
                    trigger_word: triggerWord,
                    steps: 1000,
                    create_masks: true,
                    is_style: false,
                },
                webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/fal/training`,
            });

            console.log(`[Train] FAL request_id: ${request_id}`);

            // Save request ID
            await supabaseAdmin
                .from("characters")
                .update({
                    job_id: request_id,
                    trigger_word: triggerWord,
                })
                .eq("id", characterId);

            return NextResponse.json({
                success: true,
                message: "Training started with FAL",
                requestId: request_id,
            });

        } catch (falError: any) {
            console.error("[Train] FAL error:", falError);

            // Refund credits
            await supabaseAdmin
                .from("credits")
                .update({ image_credits: credits.image_credits })
                .eq("user_id", user.id);

            await supabaseAdmin
                .from("characters")
                .update({
                    status: "failed",
                    error_message: falError.message,
                })
                .eq("id", characterId);

            return NextResponse.json(
                { error: falError.message || "FAL training failed" },
                { status: 500 }
            );
        }

    } catch (error: any) {
        console.error("[Train] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}