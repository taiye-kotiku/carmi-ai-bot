import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { deductCredits, addCredits } from "@/lib/services/credits";
import { CREDIT_COSTS } from "@/lib/config/credits";
import { updateUserStorage } from "@/lib/services/storage";

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { prompt, aspectRatio, style, imageBase64, imageMimeType } = await req.json();

        if (!prompt?.trim()) {
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
        const isEdit = !!imageBase64;
        await supabaseAdmin.from("jobs").insert({
            id: jobId,
            user_id: user.id,
            type: isEdit ? "edit_image" : "generate_image",
            status: "pending",
            progress: 0,
        });

        // Start background processing
        processImageGeneration(
            jobId,
            user.id,
            prompt,
            aspectRatio,
            style,
            imageBase64 || null,
            imageMimeType || null
        );

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
    style: string,
    imageBase64: string | null,
    imageMimeType: string | null
) {
    try {
        // Update to processing
        await supabaseAdmin
            .from("jobs")
            .update({ status: "processing", progress: 20 })
            .eq("id", jobId);

        // Build the request parts
        const parts: any[] = [];

        // If editing, add the source image first
        if (imageBase64 && imageMimeType) {
            parts.push({
                inlineData: {
                    mimeType: imageMimeType,
                    data: imageBase64,
                },
            });
            // Build edit prompt
            const editPrompt = buildEditPrompt(prompt, style);
            parts.push({ text: editPrompt });
        } else {
            // Text-to-image: enhanced prompt
            const enhancedPrompt = buildEnhancedPrompt(prompt, style, aspectRatio);
            parts.push({ text: enhancedPrompt });
        }

        // Call Google Gemini API
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [
                        {
                            parts,
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
            const errBody = await response.text();
            console.error("Gemini API error:", response.status, errBody);
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
        const totalFileSize = buffer.length;
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
        const isEdit = !!imageBase64;
        await supabaseAdmin.from("generations").insert({
            id: generationId,
            user_id: userId,
            type: "image",
            feature: isEdit ? "edit_image" : "generate_image",
            prompt,
            result_urls: [urlData.publicUrl],
            thumbnail_url: urlData.publicUrl,
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
                result: { url: urlData.publicUrl },
            })
            .eq("id", jobId);
    } catch (error: any) {
        console.error("Image processing error:", error);

        // Refund credits on failure
        await addCredits(
            userId,
            CREDIT_COSTS.image_generation,
            imageBase64 ? "החזר - עריכת תמונה נכשלה" : "החזר - יצירת תמונה נכשלה",
            jobId
        );

        await supabaseAdmin
            .from("jobs")
            .update({
                status: "failed",
                error: error.message,
            })
            .eq("id", jobId);
    }
}

function buildEditPrompt(prompt: string, style: string): string {
    const stylePrompts: Record<string, string> = {
        realistic: "photorealistic, highly detailed",
        artistic: "artistic, creative, painterly",
        cartoon: "cartoon style, animated, colorful",
        minimal: "minimalist, clean, modern",
    };

    const styleHint = stylePrompts[style] || "";
    return `Edit this image: ${prompt}. ${styleHint ? `Style: ${styleHint}.` : ""} Keep the overall composition and produce a high-quality result.`;
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
