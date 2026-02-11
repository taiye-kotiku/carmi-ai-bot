import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

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
        const { data: character, error } = await supabaseAdmin
            .from("characters")
            .select("id, status, created_at, updated_at, trained_at, error_message, lora_url, trigger_word")
            .eq("id", id)
            .eq("user_id", user.id)
            .single();

        if (error || !character) {
            console.error("[Train Status] Error:", error);
            return NextResponse.json(
                { error: "Character not found" },
                { status: 404 }
            );
        }

        // Calculate elapsed time since training started
        // Use updated_at as proxy for when training began
        let elapsed_minutes: number | null = null;
        if (character.status === "training" && character.updated_at) {
            const started = new Date(character.updated_at).getTime();
            elapsed_minutes = Math.round((Date.now() - started) / 60000);
        }

        return NextResponse.json({
            id: character.id,
            status: character.status,
            training_started_at: character.updated_at,
            trained_at: character.trained_at,
            error_message: character.error_message,
            lora_url: character.lora_url,
            trigger_word: character.trigger_word || null,
            elapsed_minutes,
        });
    } catch (error) {
        console.error("[TrainStatus] Error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}