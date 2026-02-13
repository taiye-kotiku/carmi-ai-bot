import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { processJob } from "@/lib/services/job-processor";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: job, error } = await supabase
            .from("jobs")
            .select("*")
            .eq("id", id)
            .eq("user_id", user.id)
            .single();

        if (error || !job) {
            return NextResponse.json({ error: "Job not found" }, { status: 404 });
        }

        // If job is still processing, try to advance it
        if (job.status === "processing") {
            const result = await processJob(job, user.id);
            return NextResponse.json({
                id: job.id,
                status: result.status,
                progress: result.progress,
                result: result.status === "completed" ? result.result : null,
                error: result.error,
            });
        }

        // Return current status for completed/failed jobs
        return NextResponse.json({
            id: job.id,
            status: job.status,
            progress: job.progress,
            result: job.status === "completed" ? job.result : null,
            error: job.error,
        });
    } catch (error) {
        console.error("Job status error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}