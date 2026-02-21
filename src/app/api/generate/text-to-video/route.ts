export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { deductCredits, addCredits } from "@/lib/services/credits";
import { CREDIT_COSTS } from "@/lib/config/credits";
import { nanoid } from "nanoid";

const apiKey = process.env.GOOGLE_AI_API_KEY!;

export async function POST(request: NextRequest) {
    try {
        if (!apiKey) {
            return NextResponse.json(
                { error: "שירות יצירת הוידאו לא מוגדר" },
                { status: 503 }
            );
        }

        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { error: "יש להתחבר כדי ליצור וידאו" },
                { status: 401 }
            );
        }

        const body = await request.json();
        const prompt = body.prompt;
        const aspectRatio = body.aspectRatio === "9:16" ? "9:16" : "16:9";
        const duration = body.duration === 4 ? 4 : 8;

        if (!prompt) {
            return NextResponse.json(
                { error: "נא להזין תיאור לוידאו" },
                { status: 400 }
            );
        }

        try {
            await deductCredits(user.id, "video_generation");
        } catch (err) {
            return NextResponse.json(
                { error: (err as Error).message, code: "INSUFFICIENT_CREDITS" },
                { status: 402 }
            );
        }

        const startResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/veo-3.0-fast-generate-001:predictLongRunning?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    instances: [{ prompt }],
                    parameters: {
                        aspectRatio,
                        durationSeconds: duration,
                        sampleCount: 1,
                        // ✅ DO NOT include generateAudio — not supported by veo-3.0-fast-generate-001
                    },
                }),
            }
        );

        if (!startResponse.ok) {
            const errorText = await startResponse.text();
            console.error("Veo start error:", errorText);

            await addCredits(
                user.id,
                CREDIT_COSTS.video_generation,
                "החזר - יצירת וידאו נכשלה"
            );

            return NextResponse.json(
                { error: "יצירת הוידאו נכשלה" },
                { status: 400 }
            );
        }

        const operation = await startResponse.json();
        console.log("Veo operation started:", operation.name);

        const jobId = nanoid();
        await supabaseAdmin.from("jobs").insert({
            id: jobId,
            user_id: user.id,
            type: "text_to_video",
            status: "processing",
            progress: 10,
            result: {
                operationName: operation.name,
                prompt,
                aspectRatio,
                duration,
            },
        });

        return NextResponse.json({ jobId });
    } catch (error: any) {
        console.error("Video start error:", error);

        try {
            const supabase = await createClient();
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (user) {
                await addCredits(
                    user.id,
                    CREDIT_COSTS.video_generation,
                    "החזר - יצירת וידאו נכשלה"
                );
            }
        } catch (refundError) {
            console.error("Refund failed:", refundError);
        }

        return NextResponse.json(
            { error: error.message || "יצירת הוידאו נכשלה" },
            { status: 500 }
        );
    }
}