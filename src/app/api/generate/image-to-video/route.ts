import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { imageToVideo, enhancePrompt } from "@/lib/services/gemini";
import { deductCredits, addCredits } from "@/lib/services/credits";
import { CREDIT_COSTS } from "@/lib/config/credits";
import { updateUserStorage } from "@/lib/services/storage";

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

        // Deduct credits upfront (atomic check + deduction)
        try {
            await deductCredits(user.id, "video_generation");
        } catch (err) {
            return NextResponse.json(
                {
                    error: (err as Error).message,
                    code: "INSUFFICIENT_CREDITS",
                },
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
        processImageToVideo(jobId, user.id, base64Image, prompt || "");

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
    prompt: string
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

        // Calculate total file size (video + source image)
        const totalFileSize = videoBuffer.length + imageBuffer.length;

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
            file_size_bytes: totalFileSize,
            files_deleted: false,
        });

        // Update user storage
        await updateUserStorage(userId, totalFileSize);

        // Complete job
        await supabaseAdmin
            .from("jobs")
            .update({
                status: "completed",
                progress: 100,
                result: {
                    videoUrl: urlData.publicUrl,
                    sourceImage: imageUrlData.publicUrl,
                },
            })
            .eq("id", jobId);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        // Refund credits on failure
        await addCredits(
            userId,
            CREDIT_COSTS.video_generation,
            "החזר - יצירת וידאו מתמונה נכשלה",
            jobId
        );

        await supabaseAdmin
            .from("jobs")
            .update({ status: "failed", error: errorMessage })
            .eq("id", jobId);
    }
}