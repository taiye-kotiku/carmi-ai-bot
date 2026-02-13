import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { deductCredits, addCredits } from "@/lib/services/credits";
import { CREDIT_COSTS } from "@/lib/config/credits";

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await req.formData();
        const image = formData.get("image") as File;
        const prompt = formData.get("prompt") as string;

        if (!image) {
            return NextResponse.json(
                { error: "נא להעלות תמונה" },
                { status: 400 }
            );
        }

        // Deduct credits upfront
        try {
            await deductCredits(user.id, "video_generation");
        } catch (err) {
            return NextResponse.json(
                { error: (err as Error).message, code: "INSUFFICIENT_CREDITS" },
                { status: 402 }
            );
        }

        // Convert image to base64
        const arrayBuffer = await image.arrayBuffer();
        const base64Image = Buffer.from(arrayBuffer).toString("base64");

        // Create job — store params for the polling endpoint to process
        const jobId = nanoid();
        await supabaseAdmin.from("jobs").insert({
            id: jobId,
            user_id: user.id,
            type: "image_to_video",
            status: "processing",
            progress: 5,
            result: {
                imageBase64: base64Image,
                prompt: prompt || "",
            },
        });

        // Return immediately
        return NextResponse.json({ jobId });
    } catch (error) {
        console.error("Image-to-video error:", error);
        return NextResponse.json({ error: "שגיאה בשרת" }, { status: 500 });
    }
}