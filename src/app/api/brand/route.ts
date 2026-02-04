import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: brand, error } = await supabase
            .from("brands")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error("Brand fetch error:", error);
            return NextResponse.json({ error: "שגיאה בטעינת מיתוג" }, { status: 500 });
        }

        return NextResponse.json(brand || null);
    } catch (error) {
        console.error("Brand error:", error);
        return NextResponse.json({ error: "שגיאה" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { name, tagline, primary_color, logo_url, logo_position, logo_size, logo_opacity, is_enabled } = body;

        const { data: existing } = await supabase
            .from("brands")
            .select("id")
            .eq("user_id", user.id)
            .limit(1)
            .maybeSingle();

        const payload = {
            user_id: user.id,
            name: name ?? "",
            tagline: tagline ?? null,
            primary_color: primary_color ?? null,
            logo_url: logo_url ?? null,
            logo_position: logo_position ?? "top-right",
            logo_size: logo_size ?? 12,
            logo_opacity: logo_opacity ?? 0.9,
            is_enabled: is_enabled ?? true,
        };

        if (existing) {
            const { error } = await supabase
                .from("brands")
                .update({ ...payload, updated_at: new Date().toISOString() })
                .eq("user_id", user.id);

            if (error) throw error;
        } else {
            const { error } = await supabase.from("brands").insert(payload);
            if (error) throw error;
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Brand update error:", error);
        return NextResponse.json({ error: "שגיאה בשמירה" }, { status: 500 });
    }
}
