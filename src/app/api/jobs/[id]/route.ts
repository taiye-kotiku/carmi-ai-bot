export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { processJob } from "@/lib/services/job-processor";

function getStatusText(
    jobType: string,
    status: string,
    progress: number
): string {
    if (status === "completed") return "הושלם!";
    if (status === "failed") return "נכשל";

    switch (jobType) {
        case "generate_image":
        case "edit_image":
            if (progress < 50) return "מייצר תמונה באמצעות AI...";
            return "מעבד ושומר תמונה...";
        case "text_to_video":
            if (progress < 15) return "מכין ומשפר פרומפט לוידאו...";
            if (progress < 75) return "מייצר וידאו... (עד 3 דקות)";
            return "מוריד ושומר וידאו...";
        case "image_to_video":
            if (progress < 20) return "מנתח תמונה ומכין פרומפט קולנועי...";
            if (progress < 75) return "מייצר וידאו מתמונה...";
            return "מוריד ושומר וידאו...";
        case "carousel":
            if (progress < 40) return "מייצר תוכן לשקופיות...";
            if (progress < 70) return "מעצב קרוסלה...";
            return "שומר שקופיות...";
        case "story": {
            if (progress < 12) return "מייצר תמונה 1 מ-4 לסטורי...";
            if (progress < 24) return "מייצר תמונה 2 מ-4 לסטורי...";
            if (progress < 36) return "מייצר תמונה 3 מ-4 לסטורי...";
            if (progress < 50) return "מייצר תמונה 4 מ-4 לסטורי...";
            if (progress < 56) return "מתחיל יצירת וידאו לסטורי...";
            if (progress < 95) return "מייצר וידאו לסטורי... (עד 2 דקות)";
            return "שומר סטורי...";
        }
        case "cartoonize":
            if (progress < 30) return "מנתח תמונה מקורית...";
            if (progress < 60) return "בונה תיאור דמות מפורט...";
            if (progress < 85) return "מייצר קריקטורה מותאמת אישית...";
            return "שומר תוצאה...";
        case "character_image":
            return "מייצר תמונת דמות...";
        case "character_video":
            if (progress < 15) return "מייצר תסריט לסצנות...";
            if (progress < 45) return "מייצר תמונות לסצנות...";
            if (progress < 60) return "מתחיל יצירת וידאו לסצנות...";
            if (progress < 90) return "מייצר וידאו לסצנות...";
            return "מסיים ושומר...";
        case "convert_reel":
            if (progress < 50) return "מחלץ פריימים מהרילז...";
            return "שומר תמונות...";
        case "video_clips":
            if (progress < 10) return "שולח וידאו לעיבוד...";
            if (progress < 80) return "חותך קליפים חכמים מהוידאו...";
            return "מוריד ושומר קליפים...";
        default:
            return "מעבד...";
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

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

        const { data: job, error: jobError } = await supabaseAdmin
            .from("jobs")
            .select("*")
            .eq("id", id)
            .eq("user_id", user.id)
            .single();

        if (jobError || !job) {
            return NextResponse.json(
                { error: "Job not found" },
                { status: 404 }
            );
        }

        if (job.status === "completed" || job.status === "failed") {
            return NextResponse.json({
                ...job,
                statusText: getStatusText(
                    job.type,
                    job.status,
                    job.progress ?? 0
                ),
            });
        }

        const result = await processJob(job, user.id);

        return NextResponse.json({
            id: job.id,
            type: job.type,
            user_id: job.user_id,
            created_at: job.created_at,
            status: result.status,
            progress: result.progress,
            result: result.result,
            error: result.error,
            statusText: getStatusText(
                job.type,
                result.status,
                result.progress
            ),
        });
    } catch (error: any) {
        console.error("[JobGET] Error:", error);
        return NextResponse.json(
            { error: error.message || "שגיאה בבדיקת סטטוס" },
            { status: 500 }
        );
    }
}
