import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { prompt, aspectRatio, style } = await req.json();

        if (!prompt?.trim()) {
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
            type: "generate_image",
            status: "pending",
            progress: 0,
        });

        // Start background processing
        processImageGeneration(jobId, user.id, prompt, aspectRatio, style);

        return NextResponse.json({ jobId });
    } catch (error) {
        console.error("Image generation error:", error);
        return NextResponse.json(
            { error: "שגיאה בשרת" },
            { status: 500 }
        );
    }
}

async function processImageGeneration(
    jobId: string,
    userId: string,
    prompt: string,
    aspectRatio: string,
    style: string
) {
    try {
        // Update to processing
        await supabaseAdmin
            .from("jobs")
            .update({ status: "processing", progress: 20 })
            .eq("id", jobId);

        // Build enhanced prompt
        const enhancedPrompt = buildEnhancedPrompt(prompt, style, aspectRatio);

        // Call Google Gemini API
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [{ text: enhancedPrompt }],
                        },
                    ],
                    generationConfig: {
                        responseModalities: ["Text", "Image"],
                    },
                }),
            }
        );

        await supabaseAdmin
            .from("jobs")
            .update({ progress: 60 })
            .eq("id", jobId);

        if (!response.ok) {
            throw new Error("Gemini API failed");
        }

        const data = await response.json();

        // Extract image from response
        const imagePart = data.candidates?.[0]?.content?.parts?.find(
            (p: any) => p.inlineData?.mimeType?.startsWith("image/")
        );

        if (!imagePart) {
            throw new Error("No image generated");
        }

        // Upload to Supabase Storage
        const base64Data = imagePart.inlineData.data;
        const buffer = Buffer.from(base64Data, "base64");
        const fileName = `${userId}/${jobId}.png`;

        await supabaseAdmin.storage
            .from("content")
            .upload(fileName, buffer, {
                contentType: "image/png",
                upsert: true,
            });

        const { data: urlData } = supabaseAdmin.storage
            .from("content")
            .getPublicUrl(fileName);

        await supabaseAdmin
            .from("jobs")
            .update({ progress: 80 })
            .eq("id", jobId);

        // Save generation record
        const generationId = nanoid();
        await supabaseAdmin.from("generations").insert({
            id: generationId,
            user_id: userId,
            type: "image",
            feature: "generate_image",
            prompt,
            result_urls: [urlData.publicUrl],
            thumbnail_url: urlData.publicUrl,
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

        // Record transaction
        await supabaseAdmin.from("credit_transactions").insert({
            user_id: userId,
            credit_type: "image",
            amount: -1,
            balance_after: newBalance,
            reason: "generation",
            related_id: generationId,
        });

        // Complete job
        await supabaseAdmin
            .from("jobs")
            .update({
                status: "completed",
                progress: 100,
                result: { url: urlData.publicUrl },
            })
            .eq("id", jobId);
    } catch (error: any) {
        console.error("Image processing error:", error);
        await supabaseAdmin
            .from("jobs")
            .update({
                status: "failed",
                error: error.message,
            })
            .eq("id", jobId);
    }
}

function buildEnhancedPrompt(
    prompt: string,
    style: string,
    aspectRatio: string
): string {
    const stylePrompts: Record<string, string> = {
        realistic: "photorealistic, highly detailed, professional photography",
        artistic: "artistic, creative, painterly, beautiful colors",
        cartoon: "cartoon style, animated, colorful, fun",
        minimal: "minimalist, clean, simple, modern design",
    };

    const ratioHints: Record<string, string> = {
        "1:1": "square composition",
        "16:9": "wide landscape composition",
        "9:16": "vertical portrait composition",
        "4:3": "classic 4:3 composition",
    };

    return `Create an image: ${prompt}. Style: ${stylePrompts[style] || ""}. ${ratioHints[aspectRatio] || ""}. High quality, professional.`;
}