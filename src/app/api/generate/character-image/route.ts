export const runtime = "nodejs";
export const maxDuration = 120;

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { fal } from "@fal-ai/client";
import { enhancePrompt } from "@/lib/services/gemini";
import { deductCredits, addCredits } from "@/lib/services/credits";
import { CREDIT_COSTS } from "@/lib/config/credits";
import { updateUserStorage } from "@/lib/services/storage";

fal.config({ credentials: process.env.FAL_KEY });

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
            enhance_prompt: shouldEnhance = false,
            num_images = 1,
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

        // Fetch character
        const { data: character, error: charError } = await supabase
            .from("characters")
            .select("*")
            .eq("id", character_id)
            .eq("user_id", user.id)
            .single();

        if (charError || !character) {
            await addCredits(user.id, CREDIT_COSTS.image_generation, "החזר - דמות לא נמצאה");
            return NextResponse.json(
                { error: "דמות לא נמצאה" },
                { status: 404 }
            );
        }

        if (!character.lora_url) {
            await addCredits(user.id, CREDIT_COSTS.image_generation, "החזר - דמות לא מאומנת");
            return NextResponse.json(
                { error: "הדמות עדיין לא מאומנת" },
                { status: 400 }
            );
        }

        console.log("=== CHARACTER IMAGE GENERATION ===");
        console.log("Character:", character.name);
        console.log("LoRA:", character.lora_url);

        // Enhance prompt if requested
        let finalPrompt = prompt;
        if (shouldEnhance) {
            try {
                finalPrompt = await enhancePrompt(prompt, "image");
            } catch (e) {
                console.log("Prompt enhancement failed, using original");
            }
        }

        // Add trigger word
        const fullPrompt = character.trigger_word
            ? `${character.trigger_word}, ${finalPrompt}`
            : finalPrompt;

        console.log("Full prompt:", fullPrompt);

        // Map aspect ratio
        type ImageSize = "square" | "square_hd" | "portrait_4_3" | "portrait_16_9" | "landscape_4_3" | "landscape_16_9";
        const imageSizeMap: Record<string, ImageSize> = {
            "1:1": "square",
            "16:9": "landscape_16_9",
            "9:16": "portrait_16_9",
            "4:3": "landscape_4_3",
            "3:4": "portrait_4_3",
        };

        try {
            // Generate with FLUX LoRA - SYNCHRONOUS
            const result = await fal.subscribe("fal-ai/flux-lora", {
                input: {
                    prompt: fullPrompt,
                    loras: [
                        {
                            path: character.lora_url,
                            scale: 0.9,
                        },
                    ],
                    image_size: imageSizeMap[aspect_ratio] || "square",
                    num_images: Math.min(num_images, 4),
                    output_format: "jpeg",
                    guidance_scale: 3.5,
                    num_inference_steps: 28,
                    enable_safety_checker: false,
                },
                logs: true,
                onQueueUpdate: (update) => {
                    if (update.status === "IN_PROGRESS") {
                        console.log("FAL:", update.logs?.map(l => l.message).join(", "));
                    }
                },
            });

            const images = result.data.images?.map((img: any) => img.url) || [];

            if (images.length === 0) {
                throw new Error("לא נוצרו תמונות");
            }

            console.log("Generated", images.length, "images");

            // Download images and upload to our storage to track file size
            const uploadedUrls: string[] = [];
            let totalFileSize = 0;

            for (let i = 0; i < images.length; i++) {
                try {
                    const imgResponse = await fetch(images[i]);
                    const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
                    totalFileSize += imgBuffer.length;

                    const fileName = `${user.id}/${nanoid()}/character_${i + 1}.jpg`;
                    const { error: uploadError } = await supabaseAdmin.storage
                        .from("content")
                        .upload(fileName, imgBuffer, {
                            contentType: "image/jpeg",
                            upsert: true,
                        });

                    if (!uploadError) {
                        const { data: urlData } = supabaseAdmin.storage
                            .from("content")
                            .getPublicUrl(fileName);
                        uploadedUrls.push(urlData.publicUrl);
                    } else {
                        // Fallback to fal URL
                        uploadedUrls.push(images[i]);
                    }
                } catch {
                    // Fallback to fal URL
                    uploadedUrls.push(images[i]);
                }
            }

            // Save generation record
            const generationId = nanoid();
            await supabaseAdmin.from("generations").insert({
                id: generationId,
                user_id: user.id,
                type: "image",
                feature: "character_image",
                prompt: fullPrompt,
                result_urls: uploadedUrls,
                thumbnail_url: uploadedUrls[0],
                status: "completed",
                completed_at: new Date().toISOString(),
                character_id: character.id,
                file_size_bytes: totalFileSize,
                files_deleted: false,
            });

            // Update user storage
            if (totalFileSize > 0) {
                await updateUserStorage(user.id, totalFileSize);
            }

            console.log("=== SUCCESS ===");

            return NextResponse.json({
                success: true,
                images: uploadedUrls,
                seed: result.data.seed,
                generationId,
            });

        } catch (genError: any) {
            console.error("Character image generation error:", genError);

            await addCredits(
                user.id,
                CREDIT_COSTS.image_generation,
                "החזר - יצירת תמונת דמות נכשלה"
            );

            return NextResponse.json(
                { error: genError.message || "שגיאה ביצירת התמונה" },
                { status: 500 }
            );
        }

    } catch (error: any) {
        console.error("Character image error:", error);
        return NextResponse.json(
            { error: error.message || "שגיאה ביצירת התמונה" },
            { status: 500 }
        );
    }
}