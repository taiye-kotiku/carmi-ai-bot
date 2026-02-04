import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// GET single character
export async function GET(
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

        const { data: character, error } = await supabase
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
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// PATCH update character
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

        const { data: character, error } = await supabaseAdmin
            .from("characters")
            .update(body)
            .eq("id", id)
            .eq("user_id", user.id)
            .select()
            .single();

        if (error) {
            throw error;
        }

        return NextResponse.json(character);
    } catch (error) {
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
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

        const { error } = await supabaseAdmin
            .from("characters")
            .delete()
            .eq("id", id)
            .eq("user_id", user.id);

        if (error) {
            throw error;
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}