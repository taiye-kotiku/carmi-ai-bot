import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VIZARD_API_KEY = process.env.VIZARD_API_KEY!;

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { projectId, clipId, format = "mp4" } = await request.json();

        const response = await fetch(
            `https://api.vizard.ai/v2/project/${projectId}/clip/${clipId}/download`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${VIZARD_API_KEY}`,
                },
                body: JSON.stringify({
                    format,
                    resolution: "1080p",
                }),
            }
        );

        if (!response.ok) {
            throw new Error("Failed to get download URL");
        }

        const data = await response.json();

        return NextResponse.json({
            success: true,
            downloadUrl: data.download_url,
        });
    } catch (error: any) {
        console.error("Vizard download error:", error);
        return NextResponse.json(
            { error: error.message || "הורדה נכשלה" },
            { status: 500 }
        );
    }
}