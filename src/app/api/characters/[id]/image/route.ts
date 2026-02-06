export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fal } from "@fal-ai/client";
import { nanoid } from "nanoid";

fal.config({ credentials: process.env.FAL_KEY });

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: characterId } = await params;

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { prompt, aspectRatio = "1:1", numImages = 1 } = await request.json();

        const { data: character } = await supabaseAdmin
            .from("characters")
            .select("*")
            .eq("id", characterId)
            .eq("user_id", user.id)
            .single();

        if (!character) {
            return NextResponse.json({ error: "Character not found" }, { status: 404 });
        }

        const loraUrl = character.lora_url || character.model_url;
        if (!loraUrl) {
            return NextResponse.json({ error: "Not trained" }, { status: 400 });
        }

        const triggerWord = character.trigger_word || character.settings?.trigger_word || "";
        const fullPrompt = triggerWord ? `${triggerWord}, ${prompt}` : prompt;

        type ImageSize = "square" | "square_hd" | "portrait_4_3" | "portrait_16_9" | "landscape_4_3" | "landscape_16_9";
        const imageSizeMap: Record<string, ImageSize> = {
            "1:1": "square",
            "4:3": "landscape_4_3",
            "3:4": "portrait_4_3",
            "16:9": "landscape_16_9",
            "9:16": "portrait_16_9",
        };

        console.log("FLUX LoRA image generation:", fullPrompt);

        const result = await fal.subscribe("fal-ai/flux-lora", {
            input: {
                prompt: fullPrompt,
                loras: [{ path: loraUrl, scale: 0.9 }],
                image_size: imageSizeMap[aspectRatio] || "square",
                num_images: Math.min(numImages || 1, 4),
                output_format: "jpeg",
                guidance_scale: 3.5,
                num_inference_steps: 28,
                enable_safety_checker: false,
            },
            logs: true,
        });

        const images = result.data.images?.map((img: { url: string }) => img.url) || [];
        if (images.length === 0) {
            throw new Error("לא נוצרו תמונות");
        }

        const generationId = nanoid();
        await supabaseAdmin.from("generations").insert({
            id: generationId,
            user_id: user.id,
            type: "image",
            feature: "character_image",
            prompt: fullPrompt,
            character_id: characterId,
            status: "completed",
            result_urls: images,
            thumbnail_url: images[0],
            completed_at: new Date().toISOString(),
        });

        return NextResponse.json({
            success: true,
            generationId,
            images,
        });
    } catch (error: any) {
        console.error("Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}