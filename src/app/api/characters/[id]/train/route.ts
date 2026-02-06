export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

        const character = await supabaseAdmin
            .from("characters")
            .select("*")
            .eq("id", characterId)
            .eq("user_id", user.id)
            .single()
            .then(({ data }) => data);

        if (!character) {
            return NextResponse.json({ error: "Character not found" }, { status: 404 });
        }

        const imageUrls = character.reference_images || character.image_urls || [];
        if (imageUrls.length < 15) {
            return NextResponse.json(
                { error: "Need at least 15 images (recommended ~20 from different angles, clothes, backgrounds)" },
                { status: 400 }
            );
        }

        const modalUrl = process.env.MODAL_TRAIN_ENDPOINT_URL;
        if (!modalUrl) {
            return NextResponse.json(
                { error: "Modal training endpoint not configured (MODAL_TRAIN_ENDPOINT_URL)" },
                { status: 500 }
            );
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
        const webhookUrl = `${appUrl}/api/webhooks/training-complete`;

        console.log("Starting Modal FLUX LoRA training...");
        console.log("Images:", imageUrls.length);
        console.log("Character:", character.name);

        const response = await fetch(modalUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                character_id: characterId,
                character_name: character.name,
                reference_image_urls: imageUrls,
                webhook_url: webhookUrl,
                supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
                supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Modal training failed");
        }

        if (data.error) {
            throw new Error(data.error);
        }

        await supabaseAdmin
            .from("characters")
            .update({
                model_status: "training",
                training_started_at: new Date().toISOString(),
            })
            .eq("id", characterId);

        return NextResponse.json({
            success: true,
            message: "FLUX LoRA training started",
        });

    } catch (error: any) {
        console.error("Training error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}