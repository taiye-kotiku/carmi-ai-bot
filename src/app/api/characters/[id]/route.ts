export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// GET - Fetch single character
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: character, error } = await supabaseAdmin
            .from("characters")
            .select("*")
            .eq("id", id)
            .eq("user_id", user.id)
            .single();

        if (error || !character) {
            return NextResponse.json({ error: "Character not found" }, { status: 404 });
        }

        return NextResponse.json(character);
    } catch (error) {
        console.error("Error fetching character:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// PUT - Update character
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();

        const { data: character, error } = await supabaseAdmin
            .from("characters")
            .update({
                name: body.name,
                description: body.description,
                reference_images: body.reference_images,
                settings: body.settings,
                updated_at: new Date().toISOString(),
            })
            .eq("id", id)
            .eq("user_id", user.id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json(character);
    } catch (error) {
        console.error("Error updating character:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}


// Add this after your PUT function:

// PATCH - Update character (alias for PUT)
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    return PUT(request, { params });
}



// DELETE - Delete character
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { error } = await supabaseAdmin
            .from("characters")
            .delete()
            .eq("id", id)
            .eq("user_id", user.id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting character:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}