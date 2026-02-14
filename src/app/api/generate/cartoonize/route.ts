export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { deductCredits } from "@/lib/services/credits";

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const apiKey = process.env.GOOGLE_AI_API_KEY?.trim();
        if (!apiKey) {
            return NextResponse.json(
                { error: "GOOGLE_AI_API_KEY not configured" },
                { status: 500 }
            );
        }

        const formData = await req.formData();
        const file = formData.get("image") as File | null;
        const userSubjectDescription = formData.get("subject_description") as string | null;
        const userSettingEnvironment = formData.get("setting_environment") as string | null;
        const userHobbyProfession = formData.get("hobby_profession") as string | null;

        if (!file || !file.type.startsWith("image/")) {
            return NextResponse.json(
                { error: "נא להעלות קובץ תמונה (PNG, JPG, WebP)" },
                { status: 400 }
            );
        }

        // Deduct credits upfront
        try {
            await deductCredits(user.id, "caricature_generation");
        } catch (err) {
            return NextResponse.json(
                { error: (err as Error).message, code: "INSUFFICIENT_CREDITS" },
                { status: 402 }
            );
        }

        // Convert file to base64
        const buffer = await file.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        const mimeType = file.type || "image/png";

        // Create job with params — polling endpoint handles generation
        const jobId = nanoid();
        await supabaseAdmin.from("jobs").insert({
            id: jobId,
            user_id: user.id,
            type: "cartoonize",
            status: "processing",
            progress: 5,
            result: {
                params: {
                    imageBase64: base64,
                    mimeType,
                    subjectDescription: userSubjectDescription?.trim() || null,
                    settingEnvironment: userSettingEnvironment?.trim() || null,
                    hobbyProfession: userHobbyProfession?.trim() || null,
                },
            },
        });

        // Return immediately
        return NextResponse.json({ jobId });
    } catch (error: any) {
        console.error("Cartoonize error:", error);
        return NextResponse.json(
            { error: error.message || "שגיאה ביצירת קריקטורה" },
            { status: 500 }
        );
    }
}