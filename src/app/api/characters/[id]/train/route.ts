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

        // Get character
        const { data: character } = await supabaseAdmin
            .from("characters")
            .select("*")
            .eq("id", characterId)
            .eq("user_id", user.id)
            .single();

        if (!character) {
            return NextResponse.json({ error: "Character not found" }, { status: 404 });
        }

        if (!character.image_urls || character.image_urls.length < 3) {
            return NextResponse.json({ error: "Need at least 3 images" }, { status: 400 });
        }

        // Create trigger word
        const triggerWord = `${character.name.toLowerCase().replace(/\s+/g, "")}`;

        console.log("Starting FAL training...");
        console.log("Images:", character.image_urls.length);
        console.log("Trigger word:", triggerWord);

        // Submit to FAL
        const response = await fetch("https://queue.fal.run/fal-ai/flux-lora-fast-training", {
            method: "POST",
            headers: {
                "Authorization": `Key ${process.env.FAL_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                images_data_url: character.image_urls.map((url: string) => ({
                    url: url,
                    caption: `a photo of ${triggerWord} person`
                })),
                trigger_word: triggerWord,
                steps: 1000,
                is_style: false,
                is_input_format_already_preprocessed: false,
                webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/fal/training`,
            }),
        });

        const data = await response.json();
        console.log("FAL Response:", data);

        if (!response.ok) {
            throw new Error(data.detail || "FAL training failed");
        }

        // Update character status
        await supabaseAdmin
            .from("characters")
            .update({
                status: "training",
                trigger_word: triggerWord,
                job_id: data.request_id,
            })
            .eq("id", characterId);

        return NextResponse.json({
            success: true,
            message: "Training started",
            requestId: data.request_id,
        });

    } catch (error: any) {
        console.error("Training error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}