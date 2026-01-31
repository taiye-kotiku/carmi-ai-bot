// src/app/api/characters/route.ts
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// GET - List all characters for user
export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
        .from("characters")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

// POST - Create new character
export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, reference_images, settings } = body;

    if (!name?.trim()) {
        return NextResponse.json(
            { error: "נא להזין שם לדמות" },
            { status: 400 }
        );
    }

    if (!reference_images?.length) {
        return NextResponse.json(
            { error: "נא להעלות לפחות תמונה אחת" },
            { status: 400 }
        );
    }

    // Determine initial status based on image count
    const canTrain = reference_images.length >= 3;
    const initialStatus = canTrain ? "training" : "draft";

    const { data, error } = await supabaseAdmin
        .from("characters")
        .insert({
            user_id: user.id,
            name: name.trim(),
            description: description?.trim() || null,
            reference_images,
            thumbnail_url: reference_images[0],
            settings: settings || { ip_adapter_scale: 0.8, model: "pulid" },
            status: initialStatus,
        })
        .select()
        .single();

    if (error) {
        console.error("Create character error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Auto-start training if 3+ images
    if (canTrain && process.env.MODAL_TRAINING_ENDPOINT) {
        try {
            const trainResponse = await fetch(process.env.MODAL_TRAINING_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    character_id: data.id,
                    character_name: data.name,
                    reference_image_urls: reference_images,
                    webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/training-complete`,
                }),
            });

            if (!trainResponse.ok) {
                console.error("Training trigger failed:", await trainResponse.text());
                // Update status back to draft if training failed to start
                await supabaseAdmin
                    .from("characters")
                    .update({ status: "draft" })
                    .eq("id", data.id);
            } else {
                console.log("🚀 Training started for character:", data.id);
            }
        } catch (err) {
            console.error("Training trigger error:", err);
            await supabaseAdmin
                .from("characters")
                .update({ status: "draft" })
                .eq("id", data.id);
        }
    }

    return NextResponse.json(data);
}