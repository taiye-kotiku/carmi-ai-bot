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

        const contentType = req.headers.get("content-type") || "";

        let videoUrl: string | undefined;
        let videoBase64: string | undefined;
        let options: any = {};

        if (contentType.includes("multipart/form-data")) {
            const formData = await req.formData();
            const file = formData.get("video") as File;

            if (!file) {
                return NextResponse.json({ error: "נא להעלות קובץ וידאו" }, { status: 400 });
            }

            const arrayBuffer = await file.arrayBuffer();
            videoBase64 = Buffer.from(arrayBuffer).toString("base64");

            let preferLength: number[] = [0];
            const raw = formData.get("preferLength") as string;
            if (raw) { try { preferLength = JSON.parse(raw); } catch { preferLength = [0]; } }

            options = {
                language: (formData.get("language") as string) || "he",
                preferLength,
                aspectRatio: (formData.get("aspectRatio") as string) || "9:16",
                maxClips: parseInt(formData.get("maxClips") as string) || 10,
            };
        } else {
            const body = await req.json();
            videoUrl = body.videoUrl;
            options = {
                language: body.language || "he",
                preferLength: Array.isArray(body.preferLength) ? body.preferLength : [0],
                aspectRatio: body.aspectRatio || "9:16",
                maxClips: body.maxClips || 10,
            };

            if (!videoUrl) {
                return NextResponse.json({ error: "נא לספק קישור לסרטון" }, { status: 400 });
            }
        }

        // Deduct credits
        try {
            await deductCredits(user.id, "video_clips");
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
            type: "video_clips",
            status: "processing",
            progress: 5,
            result: {
                params: {
                    videoUrl,
                    videoBuffer: videoBase64, // Will be uploaded in first poll
                    ...options,
                },
            },
        });

        return NextResponse.json({ jobId });
    } catch (error) {
        console.error("Video clips error:", error);
        return NextResponse.json({ error: "שגיאה בשרת" }, { status: 500 });
    }
}