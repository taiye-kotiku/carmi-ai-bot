// src/app/api/characters/[id]/train/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
    _request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: character, error } = await supabaseAdmin
            .from("characters")
            .select(
                "id, model_status, training_started_at, training_completed_at, training_error, model_url, settings"
            )
            .eq("id", params.id)
            .eq("user_id", user.id)
            .single();

        if (error || !character) {
            return NextResponse.json(
                { error: "Character not found" },
                { status: 404 }
            );
        }

        // Calculate elapsed time
        let elapsed_minutes: number | null = null;
        if (
            character.model_status === "training" &&
            character.training_started_at
        ) {
            const started = new Date(character.training_started_at).getTime();
            elapsed_minutes = Math.round((Date.now() - started) / 60000);
        }

        return NextResponse.json({
            id: character.id,
            status: character.model_status,
            training_started_at: character.training_started_at,
            training_completed_at: character.training_completed_at,
            training_error: character.training_error,
            model_url: character.model_url,
            trigger_word: character.settings?.trigger_word || null,
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