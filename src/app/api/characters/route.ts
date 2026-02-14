import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fal } from "@fal-ai/client";
import { deductCredits, addCredits } from "@/lib/services/credits";
import { CREDIT_COSTS } from "@/lib/config/credits";
import JSZip from "jszip";

fal.config({ credentials: process.env.FAL_KEY });

export const runtime = "nodejs";
export const maxDuration = 10; // Vercel Hobby max

export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // Fetch all characters for this specific user
        const { data, error } = await supabaseAdmin
            .from("characters")
            .select("*")
            .eq("user_id", user.id); // Only get their own characters

        if (error) throw error;

        return NextResponse.json(data);

    } catch (error: any) {
        console.error("Fetch error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    const characterId = body.characterId;

    if (!characterId) {
        return NextResponse.json({ error: "Character ID is required" }, { status: 400 });
    }

    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { data: character } = await supabaseAdmin
            .from("characters")
            .select("*")
            .eq("id", characterId)
            .eq("user_id", user.id)
            .single();

        if (!character) return NextResponse.json({ error: "Character not found" }, { status: 404 });

        const imageUrls: string[] = character.image_urls || [];
        if (imageUrls.length < 4) {
            return NextResponse.json({ error: "Not enough images to train" }, { status: 400 });
        }

        // Deduct credits
        try {
            await deductCredits(user.id, "character_training");
        } catch (err: any) {
            return NextResponse.json({ error: err.message, code: "INSUFFICIENT_CREDITS" }, { status: 402 });
        }

        try {
            // 1. Download all images in parallel and create zip
            console.log(`[Train] Downloading ${imageUrls.length} images...`);
            const zip = new JSZip();

            const downloads = await Promise.all(
                imageUrls.map(async (url: string, i: number) => {
                    const res = await fetch(url);
                    if (!res.ok) throw new Error(`Failed to download image ${i}: ${res.status}`);
                    return { index: i, buffer: await res.arrayBuffer() };
                })
            );

            downloads.forEach(({ index, buffer }) => {
                zip.file(`image_${index}.jpg`, buffer);
            });

            const zipBlob = await zip.generateAsync({ type: "blob" });

            // 2. Upload zip to fal storage (fast - their own infra)
            console.log(`[Train] Uploading zip to fal storage...`);
            const zipFile = new File([zipBlob], "training_images.zip", { type: "application/zip" });
            const zipUrl = await fal.storage.upload(zipFile);

            console.log(`[Train] Zip uploaded: ${zipUrl}`);

            // 3. Submit training job
            const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/fal/training?characterId=${characterId}&secret=${process.env.SUPABASE_SERVICE_ROLE_KEY}`;

            const result = await fal.queue.submit("fal-ai/flux-lora-fast-training", {
                input: {
                    images_data_url: zipUrl,
                    trigger_word: "ohwx",
                    is_style: false,
                    steps: 500
                },
                webhookUrl,
            });

            // 4. Update DB
            await supabaseAdmin
                .from("characters")
                .update({
                    status: "training",
                    job_id: result.request_id,
                    error_message: null
                })
                .eq("id", characterId);

            return NextResponse.json({ success: true, requestId: result.request_id });

        } catch (innerError: any) {
            // Refund credits if training submission failed
            console.error("Training submission failed:", innerError);
            await addCredits(user.id, CREDIT_COSTS.character_training, "Refund - Training failed");
            throw innerError;
        }

    } catch (error: any) {
        console.error("Train error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}