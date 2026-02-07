// src/app/api/characters/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

// GET /api/characters/:id
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const { data: character, error } = await supabase
            .from("characters")
            .select("*")
            .eq("id", id)
            .eq("user_id", user.id)
            .single();

        if (error || !character) {
            return NextResponse.json(
                { error: "Character not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ character });
    } catch (error) {
        console.error("[Character] GET error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

// PATCH /api/characters/:id
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const allowedFields: (keyof Database["public"]["Tables"]["characters"]["Update"])[] = [
            "name",
            "description",
        ];

        const updateData: Record<string, any> = {};
        for (const field of allowedFields) {
            if (field in body) {
                updateData[field as string] = body[field];
            }
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json(
                { error: "No valid fields to update" },
                { status: 400 }
            );
        }

        const { id } = await params;
        const { data: character, error } = await supabaseAdmin
            .from("characters")
            .update(updateData)
            .eq("id", id)
            .eq("user_id", user.id)
            .select()
            .single();

        if (error || !character) {
            return NextResponse.json(
                { error: "Character not found or update failed" },
                { status: 404 }
            );
        }

        return NextResponse.json({ character });
    } catch (error) {
        console.error("[Character] PATCH error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

// DELETE /api/characters/:id
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        // Fetch first to check ownership and get storage paths for cleanup
        const { data: character } = await supabase
            .from("characters")
            .select("id, user_id, status")
            .eq("id", id)
            .eq("user_id", user.id)
            .single();

        if (!character) {
            return NextResponse.json(
                { error: "Character not found" },
                { status: 404 }
            );
        }

        // Don't allow deleting while training
        if (character.status === "training") {
            return NextResponse.json(
                { error: "Cannot delete a character that is currently training" },
                { status: 409 }
            );
        }


        // Delete character (cascading will handle related records if set up)
        const { error } = await supabaseAdmin
            .from("characters")
            .delete()
            .eq("id", id)
            .eq("user_id", user.id);

        if (error) {
            console.error("[Character] Delete error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Optional: Clean up LoRA files from storage
        try {
            await supabaseAdmin.storage
                .from("loras")
                .remove([`${id}/lora.safetensors`]);
        } catch {
            // Storage cleanup is best-effort
            console.warn("[Character] Could not clean up storage for", id);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Character] Delete unexpected error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}