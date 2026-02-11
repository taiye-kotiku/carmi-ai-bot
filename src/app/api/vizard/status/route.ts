// src/app/api/vizard/status/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProjectStatus } from "@/lib/services/vizard";

export async function GET(request: NextRequest) {
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

        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get("projectId");

        if (!projectId) {
            return NextResponse.json(
                { error: "נא לספק מזהה פרויקט" },
                { status: 400 }
            );
        }

        const data = await getProjectStatus(projectId);

        // Map Vizard videos to a consistent clip format for the frontend
        const clips = (data.videos || []).map((video: any) => ({
            id: video.videoId,
            title: video.title || "",
            duration: video.videoMsDuration
                ? Math.round(video.videoMsDuration / 1000)
                : 0,
            downloadUrl: video.videoUrl || "",
            thumbnailUrl: null,
            transcript: video.transcript || "",
            viralScore: video.viralScore || "0",
            viralReason: video.viralReason || "",
            editorUrl: video.clipEditorUrl || "",
        }));

        return NextResponse.json({
            success: true,
            status: data.status,
            clips,
            projectName: data.projectName,
            shareLink: data.shareLink,
        });
    } catch (error: any) {
        console.error("[Vizard] Status error:", error);
        return NextResponse.json(
            { error: error.message || "שליפת סטטוס נכשלה" },
            { status: 500 }
        );
    }
}