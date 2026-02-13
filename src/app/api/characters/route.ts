import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fal } from "@fal-ai/client";
import JSZip from "jszip";
import { deductCredits, addCredits } from "@/lib/services/credits";
import { createImagesZip } from "@/lib/services/fal";
import { CREDIT_COSTS } from "@/lib/config/credits";

fal.config({ credentials: process.env.FAL_KEY });

// GET /api/characters
export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { data: characters, error } = await supabaseAdmin
            .from("characters")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        if (error) throw error;

        return NextResponse.json({ characters: characters || [] });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST /api/characters
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await request.json();
        const { name, description } = body;
        const imageUrls = body.reference_images || body.image_urls || [];

        if (!name?.trim()) return NextResponse.json({ error: "Character name is required" }, { status: 400 });
        if (imageUrls.length < 4) return NextResponse.json({ error: "At least 4 images required." }, { status: 400 });

        // 1. Deduct Credits
        try {
            await deductCredits(user.id, "character_training");
        } catch (err: any) {
            return NextResponse.json({ error: err.message, code: "INSUFFICIENT_CREDITS" }, { status: 402 });
        }

        // 2. Create DB Record
        const { data: character, error } = await supabaseAdmin
            .from("characters")
            .insert({
                user_id: user.id,
                name: name.trim(),
                description: description?.trim(),
                image_urls: imageUrls,
                status: "training", // Set directly to training
                trigger_word: "ohwx",
            })
            .select()
            .single();

        if (error) throw error;

        // 3. Start Training via Fal.ai
        try {
            const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/fal/training?characterId=${character.id}&secret=${process.env.SUPABASE_SERVICE_ROLE_KEY}`;

            const imagesZip = await createImagesZip(imageUrls);

            const result = await fal.queue.submit("fal-ai/flux-lora-fast-training", {
                input: {
                    images_data_url: imagesZip,
                    trigger_word: "ohwx",
                    is_style: false,
                    steps: 500
                },
                webhookUrl: webhookUrl
            });

            // Update with Request ID
            await supabaseAdmin
                .from("characters")
                .update({ job_id: result.request_id })
                .eq("id", character.id);

            return NextResponse.json({ character }, { status: 201 });

        } catch (trainError: any) {
            console.error("Training failed to start:", trainError);
            // Refund
            await addCredits(user.id, CREDIT_COSTS.character_training, "Refund - Training failed to start");
            // Mark failed
            await supabaseAdmin.from("characters").update({ status: "failed" }).eq("id", character.id);

            return NextResponse.json({ error: "Training failed to start" }, { status: 500 });
        }

    } catch (error: any) {
        console.error("Create character error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}