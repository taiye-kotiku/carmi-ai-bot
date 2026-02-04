import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({
                credits: 0,
                image_credits: 0,
                reel_credits: 0,
                video_credits: 0,
                carousel_credits: 0,
            });
        }

        const { data: credits } = await supabaseAdmin
            .from("credits")
            .select("image_credits, reel_credits, video_credits, carousel_credits")
            .eq("user_id", user.id)
            .single();

        const total = credits
            ? (credits.image_credits || 0) + (credits.reel_credits || 0) + (credits.video_credits || 0) + (credits.carousel_credits || 0)
            : 0;

        return NextResponse.json({
            credits: total,
            image_credits: credits?.image_credits ?? 0,
            reel_credits: credits?.reel_credits ?? 0,
            video_credits: credits?.video_credits ?? 0,
            carousel_credits: credits?.carousel_credits ?? 0,
        });
    } catch (error) {
        return NextResponse.json({ credits: 0, image_credits: 0, reel_credits: 0, video_credits: 0, carousel_credits: 0 });
    }
}