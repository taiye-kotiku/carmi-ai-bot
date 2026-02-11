import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { generateImage, enhancePrompt } from "@/lib/services/gemini";
import sharp from "sharp";
import { deductCredits, addCredits } from "@/lib/services/credits";
import { CREDIT_COSTS } from "@/lib/config/credits";

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { prompt, enhanceWithAI = true } = await req.json();

        if (!prompt || prompt.trim().length === 0) {
            return NextResponse.json(
                { error: "נא להזין תיאור לתמונה" },
                { status: 400 }
            );
        }

        // Deduct credits upfront (atomic check + deduction)
        try {
            await deductCredits(user.id, "image_generation");
        } catch (err) {
            return NextResponse.json(
                {
                    error: (err as Error).message,
                    code: "INSUFFICIENT_CREDITS",
                },
                { status: 402 }
            );
        }

        // Create job
        const jobId = nanoid();
        await supabaseAdmin.from("jobs").insert({
            id: jobId,
            user_id: user.id,
            type: "text_to_image",
            status: "pending",
            progress: 0,
        });

        // Process in background
        processTextToImage(jobId, user.id, prompt, enhanceWithAI);

        return NextResponse.json({ jobId });
    } catch (error) {
        console.error("Text-to-image error:", error);
        return NextResponse.json({ error: "שגיאה בשרת" }, { status: 500 });
    }
}

async function processTextToImage(
    jobId: string,
    userId: string,
    prompt: string,
    enhanceWithAI: boolean
) {
    try {
        await supabaseAdmin
            .from("jobs")
            .update({ status: "processing", progress: 10 })
            .eq("id", jobId);

        // Enhance prompt if requested
        let finalPrompt = prompt;
        if (enhanceWithAI) {
            await supabaseAdmin
                .from("jobs")
                .update({ progress: 20 })
                .eq("id", jobId);

            finalPrompt = await Promise.race([
                enhancePrompt(prompt, "image"),
                new Promise<string>((resolve) => setTimeout(() => resolve(prompt), 5000))
            ]);
        }

        await supabaseAdmin
            .from("jobs")
            .update({ progress: 30 })
            .eq("id", jobId);

        // Generate image with timeout protection
        const images = await Promise.race([
            generateImage(finalPrompt),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("Image generation timeout after 60 seconds")), 60000)
            )
        ]);

        if (images.length === 0) {
            throw new Error("No images generated");
        }

        await supabaseAdmin
            .from("jobs")
            .update({ progress: 70 })
            .eq("id", jobId);

        // Upload images to Supabase Storage (resize to 1080x1080px)
        const uploadedUrls: string[] = [];

        for (let i = 0; i < images.length; i++) {
            const base64Data = images[i].replace(/^data:image\/\w+;base64,/, "");
            const originalBuffer = Buffer.from(base64Data, "base64");

            let resizedBuffer: Buffer = originalBuffer;
            try {
                const metadata = await sharp(originalBuffer).metadata();
                if (metadata.width !== 1080 || metadata.height !== 1080) {
                    const resized = await sharp(originalBuffer)
                        .resize(1080, 1080, {
                            fit: "cover",
                            position: "center",
                        })
                        .png({ quality: 100 })
                        .toBuffer();
                    resizedBuffer = Buffer.from(resized);
                }
            } catch (resizeError) {
                console.warn("Resize failed, using original:", resizeError);
                resizedBuffer = originalBuffer;
            }

            const fileName = `${userId}/${jobId}/image_${i + 1}.png`;

            const { error: uploadError } = await supabaseAdmin.storage
                .from("content")
                .upload(fileName, resizedBuffer, {
                    contentType: "image/png",
                    upsert: true,
                });

            if (!uploadError) {
                const { data: urlData } = supabaseAdmin.storage
                    .from("content")
                    .getPublicUrl(fileName);
                uploadedUrls.push(urlData.publicUrl);
            }
        }

        await supabaseAdmin
            .from("jobs")
            .update({ progress: 90 })
            .eq("id", jobId);

        // Save generation record
        const generationId = nanoid();
        await supabaseAdmin.from("generations").insert({
            id: generationId,
            user_id: userId,
            type: "image",
            feature: "text_to_image",
            prompt: prompt,
            result_urls: uploadedUrls,
            thumbnail_url: uploadedUrls[0],
            status: "completed",
            job_id: jobId,
            completed_at: new Date().toISOString(),
        });

        // Complete job
        await supabaseAdmin
            .from("jobs")
            .update({
                status: "completed",
                progress: 100,
                result: { images: uploadedUrls, prompt: finalPrompt },
            })
            .eq("id", jobId);

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Processing error:", error);

        // Refund credits on failure
        await addCredits(
            userId,
            CREDIT_COSTS.image_generation,
            "החזר - יצירת תמונה נכשלה",
            jobId
        );

        await supabaseAdmin
            .from("jobs")
            .update({ status: "failed", error: errorMessage })
            .eq("id", jobId);
    }
}