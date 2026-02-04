import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// GET all characters
export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: characters, error } = await supabase
            .from("characters")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        if (error) {
            throw error;
        }

        return NextResponse.json(characters || []);
    } catch (error) {
        console.error("Error fetching characters:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// POST create new character
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { name, description, reference_images, trigger_word } = body;

        if (!name || !reference_images || reference_images.length < 3) {
            return NextResponse.json(
                { error: "Name and at least 3 reference images required" },
                { status: 400 }
            );
        }

        const { data: character, error } = await supabaseAdmin
            .from("characters")
            .insert({
                user_id: user.id,
                name,
                description,
                reference_images,
                trigger_word: trigger_word || name.toLowerCase().replace(/\s+/g, "_"),
                thumbnail_url: reference_images[0],
                model_status: "pending",
            })
            .select()
            .single();

        if (error) {
            throw error;
        }

        return NextResponse.json(character);
    } catch (error) {
        console.error("Error creating character:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}