import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the character
    const { data: character, error } = await supabase
        .from("characters")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

    if (error || !character) {
        return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }

    if (character.reference_images.length < 3) {
        return NextResponse.json(
            { error: "Need at least 3 images for training" },
            { status: 400 }
        );
    }

    // Update status to training
    await supabaseAdmin
        .from("characters")
        .update({
            model_status: "training",
            training_started_at: new Date().toISOString(),
            training_error: null,
        })
        .eq("id", id);

    // Trigger Modal training
    if (process.env.MODAL_TRAINING_ENDPOINT) {
        try {
            const response = await fetch(process.env.MODAL_TRAINING_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    character_id: character.id,
                    character_name: character.name,
                    reference_image_urls: character.reference_images,
                    webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/training-complete`,
                }),
            });

            if (!response.ok) {
                throw new Error("Training service unavailable");
            }

            return NextResponse.json({ success: true, message: "Training started" });
        } catch (err) {
            await supabaseAdmin
                .from("characters")
                .update({ model_status: "failed", training_error: "Failed to start training" })
                .eq("id", id);

            return NextResponse.json({ error: "Failed to start training" }, { status: 500 });
        }
    }

    return NextResponse.json({ error: "Training not configured" }, { status: 500 });
}