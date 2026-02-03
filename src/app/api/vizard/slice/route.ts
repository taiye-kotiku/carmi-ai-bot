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

        const {
            videoUrl,
            videoType = 1,  // 1=remote file, 2=YouTube, etc.
            language = "auto",
            preferLength = [0],  // 0=auto, 1=<30s, 2=30-60s, 3=60-90s, 4=90s-3min
            ext = "mp4"
        } = await request.json();

        if (!videoUrl) {
            return NextResponse.json(
                { error: "נא לספק קישור לוידאו" },
                { status: 400 }
            );
        }

        // Create project with Vizard
        const createBody: any = {
            videoUrl,
            videoType,
            lang: language,
            preferLength: Array.isArray(preferLength) ? preferLength : [preferLength],
        };

        // ext is required only for videoType 1 (remote file)
        if (videoType === 1) {
            createBody.ext = ext;
        }

        const createResponse = await fetch(`${VIZARD_BASE_URL}/project/create`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "VIZARDAI_API_KEY": VIZARD_API_KEY,
            },
            body: JSON.stringify(createBody),
        });

        if (!createResponse.ok) {
            const errorText = await createResponse.text();
            console.error("Vizard create error:", errorText);
            return NextResponse.json(
                { error: "יצירת הפרויקט נכשלה" },
                { status: createResponse.status }
            );
        }

        const project = await createResponse.json();

        return NextResponse.json({
            success: true,
            projectId: project.projectId || project.data?.projectId,
            message: "הפרויקט נוצר בהצלחה. הקליפים יהיו מוכנים בקרוב.",
        });
    } catch (error: any) {
        console.error("Vizard slice error:", error);
        return NextResponse.json(
            { error: error.message || "חיתוך הוידאו נכשל" },
            { status: 500 }
        );
    }
}