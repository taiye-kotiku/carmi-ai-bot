import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// GET character
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(character);
}

// DELETE character
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Verify ownership
        const { data: character } = await supabaseAdmin
            .from("characters")
            .select("id, user_id")
            .eq("id", id)
            .eq("user_id", user.id)
            .single();

        if (!character) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        // Delete related generations first (if foreign key exists)
        await supabaseAdmin
            .from("generations")
            .delete()
            .eq("character_id", id);

        // Delete character
        const { error } = await supabaseAdmin
            .from("characters")
            .delete()
            .eq("id", id)
            .eq("user_id", user.id);

        if (error) {
            throw error;
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Delete error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// UPDATE character
export async function PATCH(
    request: NextRequest,
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

        const { data, error } = await supabaseAdmin
            .from("characters")
            .update(body)
            .eq("id", id)
            .eq("user_id", user.id)
            .select()
            .single();

        if (error) {
            throw error;
        }

        return NextResponse.json(data);

    } catch (error: any) {
        console.error("Update error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}