import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { deductCredits } from "@/lib/services/credits";

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

        // Create job — store all parameters so polling endpoint can process
        const jobId = nanoid();
        const isEdit = !!imageBase64;
        await supabaseAdmin.from("jobs").insert({
            id: jobId,
            user_id: user.id,
            type: isEdit ? "edit_image" : "generate_image",
            status: "processing",
            progress: 10,
            result: {
                params: {
                    prompt,
                    aspectRatio,
                    style,
                    imageBase64: imageBase64 || null,
                    imageMimeType: imageMimeType || null,
                },
            },
        });

        // Do the actual generation here (Gemini is fast enough ~3-8s)
        // But wrap in try/catch so we can return jobId even if it fails
        generateImage(jobId, user.id, prompt, aspectRatio, style, imageBase64, imageMimeType);

        return NextResponse.json({ jobId });
    } catch (error) {
        console.error("Image generation error:", error);
        return NextResponse.json(
            { error: "שגיאה בשרת" },
            { status: 500 }
        );
    }
}

async function generateImage(
    jobId: string,
    userId: string,
    prompt: string,
    aspectRatio: string,
    style: string,
    imageBase64: string | null,
    imageMimeType: string | null
) {
    const { addCredits } = await import("@/lib/services/credits");
    const { CREDIT_COSTS } = await import("@/lib/config/credits");
    const { updateUserStorage } = await import("@/lib/services/storage");

    try {
        const parts: any[] = [];

        if (imageBase64 && imageMimeType) {
            parts.push({
                inlineData: {
                    mimeType: imageMimeType,
                    data: imageBase64,
                },
            });
            parts.push({ text: buildEditPrompt(prompt, style) });
        } else {
            parts.push({ text: buildEnhancedPrompt(prompt, style, aspectRatio) });
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts }],
                    generationConfig: {
                        responseModalities: ["Text", "Image"],
                    },
                }),
            }
        );

        if (!response.ok) {
            const errBody = await response.text();
            console.error("Gemini API error:", response.status, errBody);
            throw new Error("Gemini API failed");
        }

        const data = await response.json();

        const imagePart = data.candidates?.[0]?.content?.parts?.find(
            (p: any) => p.inlineData?.mimeType?.startsWith("image/")
        );

        if (!imagePart) {
            throw new Error("No image generated");
        }

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

        const generationId = nanoid();
        await supabaseAdmin.from("generations").insert({
            id: generationId,
            user_id: userId,
            type: "image",
            feature: imageBase64 ? "edit_image" : "generate_image",
            prompt,
            result_urls: [urlData.publicUrl],
            thumbnail_url: urlData.publicUrl,
            status: "completed",
            job_id: jobId,
            completed_at: new Date().toISOString(),
            file_size_bytes: totalFileSize,
            files_deleted: false,
        });

        await updateUserStorage(userId, totalFileSize);

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

function buildEnhancedPrompt(prompt: string, style: string, aspectRatio: string): string {
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