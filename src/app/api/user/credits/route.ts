import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ credits: 0 });
        }

        const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("credits")
            .eq("id", user.id)
            .single();

        return NextResponse.json({ credits: profile?.credits ?? 0 });
    } catch (error) {
        return NextResponse.json({ credits: 0 });
    }
}