// src/app/api/generate/character-image/route.ts
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { generateWithCharacter, downloadImage } from "@/lib/services/fal";
import { enhancePrompt } from "@/lib/services/gemini";

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const {
            character_id,
            prompt,
            aspect_ratio = "1:1",
            enhance_prompt = true,
        } = await req.json();

        if (!character_id) {
            return NextResponse.json(
                { error: "נא לבחור דמות" },
                { status: 400 }
            );
        }

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

        if (!credits || credits.image_credits < 2) {
            return NextResponse.json(
                { error: "אין מספיק קרדיטים (נדרשים 2)" },
                { status: 402 }
            );
        }

        // Fetch character
        const { data: character, error: charError } = await supabase
            .from("characters")
            .select("*")
            .eq("id", character_id)
            .eq("user_id", user.id)
            .single();

        if (charError || !character) {
            return NextResponse.json(
                { error: "דמות לא נמצאה" },
                { status: 404 }
            );
        }

        // Create job
        const jobId = nanoid();
        await supabaseAdmin.from("jobs").insert({
            id: jobId,
            user_id: user.id,
            type: "character_image",
            status: "pending",
            progress: 0,
        });

        // Process in background
        processCharacterImage(
            jobId,
            user.id,
            character,
            prompt,
            aspect_ratio,
            enhance_prompt
        );

        return NextResponse.json({ jobId });
    } catch (error) {
        console.error("Character image error:", error);
        return NextResponse.json({ error: "שגיאה בשרת" }, { status: 500 });
    }
}

async function processCharacterImage(
    jobId: string,
    userId: string,
    character: any,
    prompt: string,
    aspectRatio: string,
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
            // Add character context
            if (character.description) {
                finalPrompt = `${finalPrompt}. The person is: ${character.description}`;
            }
        }

        await supabaseAdmin
            .from("jobs")
            .update({ progress: 20 })
            .eq("id", jobId);

        // Generate with character consistency
        const settings = character.settings || { ip_adapter_scale: 0.8, model: "pulid" };

        const result = await generateWithCharacter({
            prompt: finalPrompt,
            referenceImages: character.reference_images,
            model: settings.model || "pulid",
            aspectRatio,
            ipAdapterScale: settings.ip_adapter_scale || 0.8,
        });

        await supabaseAdmin
            .from("jobs")
            .update({ progress: 70 })
            .eq("id", jobId);

        if (!result.images.length) {
            throw new Error("No images generated");
        }

        // Download and upload to Supabase Storage
        const uploadedUrls: string[] = [];

        for (let i = 0; i < result.images.length; i++) {
            const imageBuffer = await downloadImage(result.images[i]);
            const fileName = `${userId}/${jobId}/character_${i + 1}.png`;

            const { error: uploadError } = await supabaseAdmin.storage
                .from("content")
                .upload(fileName, imageBuffer, {
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
            feature: "character_image",
            prompt,
            result_urls: uploadedUrls,
            thumbnail_url: uploadedUrls[0],
            status: "completed",
            job_id: jobId,
            character_id: character.id,
            completed_at: new Date().toISOString(),
        });

        // Deduct 2 credits (character images cost more)
        const { data: currentCredits } = await supabaseAdmin
            .from("credits")
            .select("image_credits")
            .eq("user_id", userId)
            .single();

        const newBalance = (currentCredits?.image_credits || 2) - 2;

        await supabaseAdmin
            .from("credits")
            .update({ image_credits: newBalance })
            .eq("user_id", userId);

        await supabaseAdmin.from("credit_transactions").insert({
            user_id: userId,
            credit_type: "image",
            amount: -2,
            balance_after: newBalance,
            reason: "character_image",
            related_id: generationId,
        });

        // Complete job
        await supabaseAdmin
            .from("jobs")
            .update({
                status: "completed",
                progress: 100,
                result: {
                    images: uploadedUrls,
                    prompt: finalPrompt,
                    character_id: character.id,
                },
            })
            .eq("id", jobId);

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Character image processing error:", error);
        await supabaseAdmin
            .from("jobs")
            .update({ status: "failed", error: errorMessage })
            .eq("id", jobId);
    }
}