import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { generateVideo, enhancePrompt } from "@/lib/services/gemini";

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { prompt, duration = 5, aspectRatio = "9:16" } = await req.json();

        if (!prompt || prompt.trim().length === 0) {
            return NextResponse.json(
                { error: "נא להזין תיאור לסרטון" },
                { status: 400 }
            );
        }

        // Check credits (videos cost more)
        const { data: credits } = await supabase
            .from("credits")
            .select("reel_credits")
            .eq("user_id", user.id)
            .single();

        const videoCost = 3; // Videos cost 3 credits
        if (!credits || credits.reel_credits < videoCost) {
            return NextResponse.json(
                { error: `נדרשים ${videoCost} קרדיטים ליצירת סרטון` },
                { status: 402 }
            );
        }

        // Create job
        const jobId = nanoid();
        await supabaseAdmin.from("jobs").insert({
            id: jobId,
            user_id: user.id,
            type: "text_to_video",
            status: "pending",
            progress: 0,
        });

        // Process in background
        processTextToVideo(jobId, user.id, prompt, duration, aspectRatio, videoCost);

        return NextResponse.json({ jobId });
    } catch (error) {
        console.error("Text-to-video error:", error);
        return NextResponse.json({ error: "שגיאה בשרת" }, { status: 500 });
    }
}

async function processTextToVideo(
    jobId: string,
    userId: string,
    prompt: string,
    duration: number,
    aspectRatio: string,
    videoCost: number
) {
    try {
        await supabaseAdmin
            .from("jobs")
            .update({ status: "processing", progress: 10 })
            .eq("id", jobId);

        // Enhance prompt
        const enhancedPrompt = await enhancePrompt(prompt, "video");

        await supabaseAdmin
            .from("jobs")
            .update({ progress: 20 })
            .eq("id", jobId);

        // Generate video
        const videoUrl = await generateVideo(enhancedPrompt);

        await supabaseAdmin
            .from("jobs")
            .update({ progress: 80 })
            .eq("id", jobId);

        // Download and upload to our storage
        const videoResponse = await fetch(videoUrl);
        const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

        const fileName = `${userId}/${jobId}/video.mp4`;

        const { error: uploadError } = await supabaseAdmin.storage
            .from("content")
            .upload(fileName, videoBuffer, {
                contentType: "video/mp4",
                upsert: true,
            });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabaseAdmin.storage
            .from("content")
            .getPublicUrl(fileName);

        // Save generation
        const generationId = nanoid();
        await supabaseAdmin.from("generations").insert({
            id: generationId,
            user_id: userId,
            type: "video",
            feature: "text_to_video",
            prompt: prompt,
            result_urls: [urlData.publicUrl],
            thumbnail_url: urlData.publicUrl,
            status: "completed",
            job_id: jobId,
            completed_at: new Date().toISOString(),
        });

        // Deduct credits
        const { data: currentCredits } = await supabaseAdmin
            .from("credits")
            .select("reel_credits")
            .eq("user_id", userId)
            .single();

        const newBalance = (currentCredits?.reel_credits || videoCost) - videoCost;

        await supabaseAdmin
            .from("credits")
            .update({ reel_credits: newBalance })
            .eq("user_id", userId);

        await supabaseAdmin.from("credit_transactions").insert({
            user_id: userId,
            credit_type: "reel",
            amount: -videoCost,
            balance_after: newBalance,
            reason: "text_to_video",
            related_id: generationId,
        });

        await supabaseAdmin
            .from("jobs")
            .update({
                status: "completed",
                progress: 100,
                result: { videoUrl: urlData.publicUrl, prompt: enhancedPrompt },
            })
            .eq("id", jobId);

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        await supabaseAdmin
            .from("jobs")
            .update({ status: "failed", error: errorMessage })
            .eq("id", jobId);
    }
}