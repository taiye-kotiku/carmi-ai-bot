import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const characterId = params.id;

        // Get character with reference images
        const { data: character, error: fetchError } = await supabase
            .from("characters")
            .select("*")
            .eq("id", characterId)
            .single();

        if (fetchError || !character) {
            return NextResponse.json({ error: "Character not found" }, { status: 404 });
        }

        // Get reference images
        const { data: images } = await supabase
            .from("reference_images")
            .select("image_url")
            .eq("character_id", characterId);

        if (!images || images.length < 3) {
            return NextResponse.json(
                { error: "Need at least 3 reference images" },
                { status: 400 }
            );
        }

        const imageUrls = images.map((img) => img.image_url);

        // Update status to training
        await supabase
            .from("characters")
            .update({ status: "training" })
            .eq("id", characterId);

        // Call Modal endpoint
        const modalResponse = await fetch(process.env.MODAL_TRAINING_ENDPOINT!, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                character_id: characterId,
                character_name: character.name,
                reference_image_urls: imageUrls,
                webhook_url: "https://carmi-ai-bot.vercel.app/api/webhooks/training-complete",
            }),
        });

        const modalResult = await modalResponse.json();

        if (!modalResponse.ok) {
            throw new Error(modalResult.error || "Modal request failed");
        }

        console.log("🚀 Training started:", modalResult);

        return NextResponse.json({
            success: true,
            message: "Training started",
            character_id: characterId,
        });

    } catch (err) {
        console.error("❌ Training trigger error:", err);
        return NextResponse.json({ error: "Failed to start training" }, { status: 500 });
    }
}