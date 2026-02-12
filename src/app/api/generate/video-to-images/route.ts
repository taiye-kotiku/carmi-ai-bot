import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { deductCredits } from "@/lib/services/credits";

/**
 * Video-to-Images API
 *
 * Frame extraction happens client-side (HTML5 Video + Canvas).
 * This endpoint only handles:
 *   1. Credit deduction
 *   2. Saving the generation record
 */
export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const body = await req.json();
        const { imageUrls, imageCount } = body;

        if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
            return NextResponse.json(
                { error: "נא לספק תמונות" },
                { status: 400 }
            );
        }

        // Deduct credits
        try {
            await deductCredits(user.id, "video_generation");
        } catch (err) {
            return NextResponse.json(
                {
                    error: (err as Error).message,
                    code: "INSUFFICIENT_CREDITS",
                },
                { status: 402 }
            );
        }

        // Save generation record
        const generationId = nanoid();
        await supabaseAdmin.from("generations").insert({
            id: generationId,
            user_id: user.id,
            type: "image",
            feature: "video_to_images",
            prompt: `Extracted ${imageCount || imageUrls.length} best frames from video`,
            result_urls: imageUrls,
            thumbnail_url: imageUrls[0],
            status: "completed",
            completed_at: new Date().toISOString(),
        });

        return NextResponse.json({
            success: true,
            generationId,
            count: imageUrls.length,
        });
    } catch (error) {
        console.error("Video to images error:", error);
        return NextResponse.json(
            { error: "שגיאה בשרת: " + (error instanceof Error ? error.message : "Unknown error") },
            { status: 500 }
        );
    }
}
