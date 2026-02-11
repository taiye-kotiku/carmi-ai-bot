// src/app/api/vizard/download/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

        const { videoUrl } = await request.json();

        // Vizard videos already have a direct download URL from the query response.
        // The videoUrl from the query endpoint is a CDN link valid for 7 days.
        // If expired, the client should re-query the status endpoint to get a fresh URL.
        if (!videoUrl) {
            return NextResponse.json(
                { error: "נא לספק קישור לוידאו" },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            downloadUrl: videoUrl,
        });
    } catch (error: any) {
        console.error("[Vizard] Download error:", error);
        return NextResponse.json(
            { error: error.message || "הורדה נכשלה" },
            { status: 500 }
        );
    }
}