import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { imageToVideo, enhancePrompt } from "@/lib/services/gemini";

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await req.formData();
        const image = formData.get("image") as File;
        const prompt = formData.get("prompt") as string;

        if (!image) {
            return NextResponse.json(
                { error: "נא להעלות תמונה" },
                { status: 400 }
            );
        }

        // Check credits
        const { data: credits } = await supabase
            .from("credits")
            .select("video_credits")
            .eq("user_id", user.id)
            .single();

        const videoCost = 20; // Fixed cost: 20 credits per video
        if (!credits || credits.video_credits < videoCost) {
            return NextResponse.json(
                { error: `נדרשים ${videoCost} קרדיטים ליצירת סרטון` },
                { status: 402 }
            );
        }

        // Convert image to base64
        const arrayBuffer = await image.arrayBuffer();
        const base64Image = Buffer.from(arrayBuffer).toString("base64");

        // Create job
        const jobId = nanoid();
        await supabaseAdmin.from("jobs").insert({
            id: jobId,
            user_id: user.id,
            type: "image_to_video",
            status: "pending",
            progress: 0,
        });

        // Process in background
        processImageToVideo(jobId, user.id, base64Image, prompt || "", videoCost);

        return NextResponse.json({ jobId });
    } catch (error) {
        console.error("Image-to-video error:", error);
        return NextResponse.json({ error: "שגיאה בשרת" }, { status: 500 });
    }
}

async function processImageToVideo(
    jobId: string,
    userId: string,
    imageBase64: string,
    prompt: string,
    videoCost: number
) {
    try {
        await supabaseAdmin
            .from("jobs")
            .update({ status: "processing", progress: 10 })
            .eq("id", jobId);

        // Enhance prompt if provided
        let finalPrompt = prompt;
        if (prompt) {
            finalPrompt = await enhancePrompt(prompt, "video");
        } else {
            finalPrompt = "Animate this image with subtle movement, cinematic quality";
        }

        await supabaseAdmin
            .from("jobs")
            .update({ progress: 20 })
            .eq("id", jobId);

        // Generate video from image
        const videoUrl = await imageToVideo(imageBase64, finalPrompt);

        await supabaseAdmin
            .from("jobs")
            .update({ progress: 80 })
            .eq("id", jobId);

        // Download and upload to storage
        const videoResponse = await fetch(videoUrl);
        const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

        const fileName = `${userId}/${jobId}/video.mp4`;

        await supabaseAdmin.storage
            .from("content")
            .upload(fileName, videoBuffer, {
                contentType: "video/mp4",
                upsert: true,
            });

        const { data: urlData } = supabaseAdmin.storage
            .from("content")
            .getPublicUrl(fileName);

        // Save original image too
        const imageBuffer = Buffer.from(imageBase64, "base64");
        const imageName = `${userId}/${jobId}/source.jpg`;
        await supabaseAdmin.storage
            .from("content")
            .upload(imageName, imageBuffer, {
                contentType: "image/jpeg",
                upsert: true,
            });

        const { data: imageUrlData } = supabaseAdmin.storage
            .from("content")
            .getPublicUrl(imageName);

        // Save generation
        const generationId = nanoid();
        await supabaseAdmin.from("generations").insert({
            id: generationId,
            user_id: userId,
            type: "video",
            feature: "image_to_video",
            source_url: imageUrlData.publicUrl,
            prompt: prompt,
            result_urls: [urlData.publicUrl],
            thumbnail_url: imageUrlData.publicUrl,
            status: "completed",
            job_id: jobId,
            completed_at: new Date().toISOString(),
        });

        // Deduct credits
        const { data: currentCredits } = await supabaseAdmin
            .from("credits")
            .select("video_credits")
            .eq("user_id", userId)
            .single();

        const newBalance = (currentCredits?.video_credits || videoCost) - videoCost;

        await supabaseAdmin
            .from("credits")
            .update({ video_credits: newBalance })
            .eq("user_id", userId);

        await supabaseAdmin.from("credit_transactions").insert({
            user_id: userId,
            credit_type: "video",
            amount: -videoCost,
            balance_after: newBalance,
            reason: "image_to_video",
            related_id: generationId,
        });

        await supabaseAdmin
            .from("jobs")
            .update({
                status: "completed",
                progress: 100,
                result: {
                    videoUrl: urlData.publicUrl,
                    sourceImage: imageUrlData.publicUrl
                },
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