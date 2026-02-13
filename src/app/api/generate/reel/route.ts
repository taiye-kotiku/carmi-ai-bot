import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { isValidInstagramUrl } from "@/lib/utils";
import { deductCredits } from "@/lib/services/credits";

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { url } = await req.json();

        if (!isValidInstagramUrl(url)) {
            return NextResponse.json(
                { error: "קישור אינסטגרם לא תקין" },
                { status: 400 }
            );
        }

        // Deduct credits
        try {
            await deductCredits(user.id, "video_generation");
        } catch (err) {
            return NextResponse.json(
                { error: (err as Error).message, code: "INSUFFICIENT_CREDITS" },
                { status: 402 }
            );
        }

        // Create job with params
        const jobId = nanoid();
        await supabaseAdmin.from("jobs").insert({
            id: jobId,
            user_id: user.id,
            type: "convert_reel",
            status: "processing",
            progress: 5,
            result: {
                params: { url },
            },
        });

        // Return immediately
        return NextResponse.json({ jobId });
    } catch (error) {
        console.error("Reel conversion error:", error);
        return NextResponse.json({ error: "שגיאה בשרת" }, { status: 500 });
    }
}