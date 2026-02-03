export const runtime = "nodejs";
export const maxDuration = 300;

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

        const { videoUrl, language = "he" } = await request.json();

        if (!videoUrl) {
            return NextResponse.json(
                { error: "נא לספק קישור לוידאו" },
                { status: 400 }
            );
        }

        // Step 1: Create project with video
        const createResponse = await fetch("https://api.vizard.ai/v2/project", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${VIZARD_API_KEY}`,
            },
            body: JSON.stringify({
                video_url: videoUrl,
                language: language,
                auto_clip: true, // Auto-generate clips
            }),
        });

        if (!createResponse.ok) {
            const error = await createResponse.text();
            console.error("Vizard create error:", error);
            throw new Error("Failed to create Vizard project");
        }

        const project = await createResponse.json();

        // Step 2: Poll for clips
        const clips = await pollForClips(project.project_id);

        return NextResponse.json({
            success: true,
            projectId: project.project_id,
            clips,
        });
    } catch (error: any) {
        console.error("Vizard slice error:", error);
        return NextResponse.json(
            { error: error.message || "חיתוך הוידאו נכשל" },
            { status: 500 }
        );
    }
}

async function pollForClips(projectId: string): Promise<any[]> {
    const maxAttempts = 60; // 5 minutes

    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000));

        const response = await fetch(`https://api.vizard.ai/v2/project/${projectId}`, {
            headers: {
                "Authorization": `Bearer ${VIZARD_API_KEY}`,
            },
        });

        if (!response.ok) continue;

        const data = await response.json();

        if (data.status === "completed" && data.clips?.length > 0) {
            return data.clips.map((clip: any) => ({
                id: clip.clip_id,
                title: clip.title,
                startTime: clip.start_time,
                endTime: clip.end_time,
                duration: clip.duration,
                downloadUrl: clip.download_url,
                thumbnailUrl: clip.thumbnail_url,
                transcript: clip.transcript,
            }));
        }

        if (data.status === "failed") {
            throw new Error("Vizard processing failed");
        }
    }

    throw new Error("Vizard processing timed out");
}