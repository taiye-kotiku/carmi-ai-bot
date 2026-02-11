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
            maxClips,
            keywords,
            projectName,
            removeSilence = true,
            subtitles = true,
            highlight = true,
            autoBroll = true,
            headline = true,
            emoji = false,
            templateId,
        } = body;

        if (!videoUrl) {
            return NextResponse.json(
                { error: "נא לספק קישור לוידאו" },
                { status: 400 }
            );
        }

        // Pass preferLength directly as the array — no conversion
        const result = await createProjectFromUrl(videoUrl, {
            language,
            preferLength: Array.isArray(preferLength)
                ? preferLength
                : [preferLength],
            aspectRatio,
            maxClips,
            keywords,
            projectName,
            templateId,
            removeSilence,
            subtitles,
            highlight,
            autoBroll,
            headline,
            emoji,
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