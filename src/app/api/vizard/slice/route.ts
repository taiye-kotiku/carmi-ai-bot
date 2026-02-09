// src/app/api/vizard/slice/route.ts
export const runtime = "nodejs";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VIZARD_API_KEY = process.env.VIZARD_API_KEY!;
const VIZARD_BASE_URL = "https://elb-api.vizard.ai/hvizard-server-front/open-api/v1";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();

        const {
            videoUrl,
            videoType = 1,  // 1=remote file, 2=YouTube
            language = "auto",
            preferLength = [2, 3],  // Default: 30-60s and 60-90s (meaningful shorts)
            ext = "mp4",
            // Advanced options
            ratioOfClip = 1,  // 1=9:16 vertical (TikTok, Reels, Shorts)
            templateId,
            maxClipNumber,
            keywords,
            projectName,
        } = body;

        if (!videoUrl) {
            return NextResponse.json(
                { error: "נא לספק קישור לוידאו" },
                { status: 400 }
            );
        }

        // Build request body
        const createBody: Record<string, any> = {
            videoUrl,
            videoType,
            lang: language,
            preferLength: Array.isArray(preferLength) ? preferLength : [preferLength],

            // Recommended settings for quality shorts
            ratioOfClip,
            removeSilenceSwitch: 1,  // Remove silence and filler words
            subtitleSwitch: 1,        // Show subtitles
            highlightSwitch: 1,       // Highlight keywords
            autoBrollSwitch: 1,       // Auto B-roll
            headlineSwitch: 1,        // AI-generated headline hook
        };

        // ext is required only for videoType 1 (remote file)
        if (videoType === 1) {
            createBody.ext = ext;
        }

        // Optional parameters
        if (templateId) {
            createBody.templateId = templateId;
        }

        if (maxClipNumber && maxClipNumber > 0 && maxClipNumber <= 100) {
            createBody.maxClipNumber = maxClipNumber;
        }

        if (keywords) {
            createBody.keywords = keywords;
        }

        if (projectName) {
            createBody.projectName = projectName;
        }

        console.log("[Vizard] Creating project:", {
            videoUrl: videoUrl.slice(0, 50) + "...",
            videoType,
            preferLength: createBody.preferLength,
            ratioOfClip,
        });

        const createResponse = await fetch(`${VIZARD_BASE_URL}/project/create`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "VIZARDAI_API_KEY": VIZARD_API_KEY,
            },
            body: JSON.stringify(createBody),
        });

        const responseText = await createResponse.text();

        if (!createResponse.ok) {
            console.error("[Vizard] Create error:", responseText);
            return NextResponse.json(
                { error: "יצירת הפרויקט נכשלה", details: responseText },
                { status: createResponse.status }
            );
        }

        let project;
        try {
            project = JSON.parse(responseText);
        } catch {
            console.error("[Vizard] Invalid JSON response:", responseText);
            return NextResponse.json(
                { error: "תגובה לא תקינה מ-Vizard" },
                { status: 500 }
            );
        }

        const projectId = project.projectId || project.data?.projectId;

        console.log("[Vizard] Project created:", projectId);

        return NextResponse.json({
            success: true,
            projectId,
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