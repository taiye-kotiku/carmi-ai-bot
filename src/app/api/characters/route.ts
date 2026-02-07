// src/app/api/characters/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// GET /api/characters — List user's characters
export async function GET() {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: characters, error } = await supabaseAdmin
            .from("characters")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("[Characters] List error:", error);
            return NextResponse.json(
                { error: error.message, details: error },
                { status: 500 }
            );
        }

        return NextResponse.json({ characters: characters || [] });
    } catch (error) {
        console.error("[Characters] Unexpected error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            { error: "Internal server error", message },
            { status: 500 }
        );
    }
}

// POST /api/characters — Create new character
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { name, description, reference_images } = body;

        // Validation
        if (!name || typeof name !== "string" || !name.trim()) {
            return NextResponse.json(
                { error: "Character name is required" },
                { status: 400 }
            );
        }

        if (
            !reference_images ||
            !Array.isArray(reference_images) ||
            reference_images.length < 5
        ) {
            return NextResponse.json(
                {
                    error: `At least 5 reference images are required. Got ${reference_images?.length ?? 0
                        }.`,
                },
                { status: 400 }
            );
        }

        // Use the first image as thumbnail
        const thumbnailUrl = reference_images[0] || null;

        const { data: character, error } = await supabaseAdmin
            .from("characters")
            .insert({
                user_id: user.id,
                name: name.trim(),
                description: description?.trim() || null,
                thumbnail_url: thumbnailUrl,
                status: "pending",
                settings: {
                    reference_images,
                },
            })
            .select()
            .single();

        if (error) {
            console.error("[Characters] Create error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ character }, { status: 201 });
    } catch (error) {
        console.error("[Characters] Create unexpected error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}