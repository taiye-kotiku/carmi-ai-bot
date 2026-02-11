// src/app/api/vizard/slice/route.ts

export const runtime = "nodejs";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createProjectFromUrl } from "@/lib/services/vizard";

export async function POST(request: NextRequest) {
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

        const body = await request.json();

        const {
            videoUrl,
            language = "auto",
            preferLength = [0],
            aspectRatio = "9:16",
            // Dynamic from UI
            emoji = false,
            keywords,
            maxClips,
            projectName,
            // Fixed — always ON regardless of what frontend sends
            // removeSilence, subtitles, highlight, autoBroll, headline
        } = body;

        if (!videoUrl) {
            return NextResponse.json(
                { error: "נא לספק קישור לוידאו" },
                { status: 400 }
            );
        }

        // Validate preferLength — block value 1 (under 30s)
        let validPreferLength = Array.isArray(preferLength)
            ? preferLength.filter((v: number) => [0, 2, 3, 4].includes(v))
            : [0];

        if (validPreferLength.length === 0) {
            validPreferLength = [0];
        }

        const result = await createProjectFromUrl(videoUrl, {
            language,
            preferLength: validPreferLength,
            aspectRatio,
            // Dynamic
            emoji,
            keywords: keywords || undefined,
            maxClips: maxClips || undefined,
            projectName: projectName || undefined,
            // Fixed — always ON
            removeSilence: true,
            subtitles: true,
            highlight: true,
            autoBroll: true,
            headline: true,
        });

        return NextResponse.json({
            success: true,
            projectId: result.projectId,
            shareLink: result.shareLink,
            message: "הפרויקט נוצר בהצלחה. הקליפים יהיו מוכנים בקרוב.",
        });
    } catch (error: any) {
        console.error("[Vizard] Slice error:", error);
        return NextResponse.json(
            { error: error.message || "חיתוך הוידאו נכשל" },
            { status: 500 }
        );
    }
}