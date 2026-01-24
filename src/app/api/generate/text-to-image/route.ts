import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { generateImage, enhancePrompt } from "@/lib/services/gemini";

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

        // Check credits
        const { data: credits } = await supabase
            .from("credits")
            .select("image_credits")
            .eq("user_id", user.id)
            .single();

        if (!credits || credits.image_credits < 1) {
            return NextResponse.json(
                { error: "אין מספיק קרדיטים ליצירת תמונה" },
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
            finalPrompt = await enhancePrompt(prompt, "image");
        }

        await supabaseAdmin
            .from("jobs")
            .update({ progress: 30 })
            .eq("id", jobId);

        // Generate image
        const images = await generateImage(finalPrompt);

        if (images.length === 0) {
            throw new Error("No images generated");
        }

        await supabaseAdmin
            .from("jobs")
            .update({ progress: 70 })
            .eq("id", jobId);

        // Upload images to Supabase Storage
        const uploadedUrls: string[] = [];

        for (let i = 0; i < images.length; i++) {
            const base64Data = images[i].replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Data, "base64");

            const fileName = `${userId}/${jobId}/image_${i + 1}.png`;

            const { error: uploadError } = await supabaseAdmin.storage
                .from("content")
                .upload(fileName, buffer, {
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

        // Deduct credit
        const { data: currentCredits } = await supabaseAdmin
            .from("credits")
            .select("image_credits")
            .eq("user_id", userId)
            .single();

        const newBalance = (currentCredits?.image_credits || 1) - 1;

        await supabaseAdmin
            .from("credits")
            .update({ image_credits: newBalance })
            .eq("user_id", userId);

        await supabaseAdmin.from("credit_transactions").insert({
            user_id: userId,
            credit_type: "image",
            amount: -1,
            balance_after: newBalance,
            reason: "text_to_image",
            related_id: generationId,
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
        await supabaseAdmin
            .from("jobs")
            .update({ status: "failed", error: errorMessage })
            .eq("id", jobId);
    }
}