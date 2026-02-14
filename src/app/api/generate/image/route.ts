import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { deductCredits } from "@/lib/services/credits";

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { prompt, aspectRatio, style, imageBase64, imageMimeType, imageBase642, imageMimeType2 } = await req.json();

        if (!prompt?.trim()) {
            return NextResponse.json(
                { error: "נא להזין תיאור לתמונה" },
                { status: 400 }
            );
        }

        // Deduct credits upfront
        try {
            await deductCredits(user.id, "image_generation");
        } catch (err) {
            return NextResponse.json(
                {
                    error: (err as Error).message,
                    code: "INSUFFICIENT_CREDITS",
                },
                { status: 402 }
            );
        }

        // Create job with params — polling endpoint handles generation
        const jobId = nanoid();
        const isEdit = !!imageBase64;
        await supabaseAdmin.from("jobs").insert({
            id: jobId,
            user_id: user.id,
            type: isEdit ? "edit_image" : "generate_image",
            status: "processing",
            progress: 10,
            result: {
                params: {
                    prompt,
                    aspectRatio,
                    style,
                    imageBase64: imageBase64 || null,
                    imageMimeType: imageMimeType || null,
                    imageBase642: imageBase642 || null,
                    imageMimeType2: imageMimeType2 || null,
                },
            },
        });

        // Return immediately — client polls /api/jobs/[id]
        return NextResponse.json({ jobId });
    } catch (error) {
        console.error("Image generation error:", error);
        return NextResponse.json(
            { error: "שגיאה בשרת" },
            { status: 500 }
        );
    }
}