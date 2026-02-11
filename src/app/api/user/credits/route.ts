import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: credits } = await supabase
        .from("credits")
        .select("credits")
        .eq("user_id", user.id)
        .single();

    return NextResponse.json({
        credits: credits?.credits ?? 0,
    });
}