// src/app/api/characters/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// GET /api/characters
export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

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
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ characters: characters || [] });
    } catch (error: any) {
        console.error("[Characters] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST /api/characters
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { name, description } = body;

        // Accept BOTH field names for compatibility
        const imageUrls = body.reference_images || body.image_urls || [];

        console.log("[Characters] POST:", { name, imageCount: imageUrls?.length });

        // Validation
        if (!name || typeof name !== "string" || !name.trim()) {
            return NextResponse.json(
                { error: "Character name is required" },
                { status: 400 }
            );
        }

        if (!Array.isArray(imageUrls) || imageUrls.length < 5) {
            return NextResponse.json(
                { error: `At least 5 reference images are required. Got ${imageUrls?.length ?? 0}.` },
                { status: 400 }
            );
        }

        const { data: character, error } = await supabaseAdmin
            .from("characters")
            .insert({
                user_id: user.id,
                name: name.trim(),
                description: description?.trim() || null,
                image_urls: imageUrls,
                status: "pending",
                trigger_word: "ohwx",
            })
            .select()
            .single();

        if (error) {
            console.error("[Characters] Create error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        console.log("[Characters] Created:", character.id);
        return NextResponse.json({ character }, { status: 201 });

    } catch (error: any) {
        console.error("[Characters] Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to create character" },
            { status: 500 }
        );
    }
}