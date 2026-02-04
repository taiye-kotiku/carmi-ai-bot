export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import JSZip from "jszip";

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

        // Get character
        const { data: character, error: fetchError } = await supabaseAdmin
            .from("characters")
            .select("*")
            .eq("id", characterId)
            .eq("user_id", user.id)
            .single();

        if (fetchError || !character) {
            return NextResponse.json({ error: "Character not found" }, { status: 404 });
        }

        if (!character.image_urls || character.image_urls.length < 3) {
            return NextResponse.json({ error: "צריך לפחות 3 תמונות לאימון" }, { status: 400 });
        }

        // Create trigger word
        const triggerWord = character.name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "")
            .slice(0, 20) || `char${Date.now()}`;

        console.log("=== Starting FAL Training ===");
        console.log("Character:", character.name);
        console.log("Images:", character.image_urls.length);
        console.log("Trigger word:", triggerWord);

        // Step 1: Create ZIP file with images
        const zip = new JSZip();

        for (let i = 0; i < character.image_urls.length; i++) {
            const imageUrl = character.image_urls[i];

            try {
                // Download image
                const response = await fetch(imageUrl);
                const arrayBuffer = await response.arrayBuffer();

                // Determine extension
                const contentType = response.headers.get("content-type") || "image/jpeg";
                const ext = contentType.includes("png") ? "png" : "jpg";

                // Add to zip
                zip.file(`image_${i}.${ext}`, arrayBuffer);

                // Add caption file
                zip.file(`image_${i}.txt`, `a photo of ${triggerWord} person`);

                console.log(`Added image ${i + 1}/${character.image_urls.length}`);
            } catch (e) {
                console.error(`Failed to download image ${i}:`, e);
            }
        }

        // Generate ZIP buffer
        const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
        console.log("ZIP created, size:", zipBuffer.length);

        // Step 2: Upload ZIP to Supabase storage
        const zipFileName = `training/${characterId}/${Date.now()}.zip`;

        const { error: uploadError } = await supabaseAdmin.storage
            .from("training-data")
            .upload(zipFileName, zipBuffer, {
                contentType: "application/zip",
                upsert: true,
            });

        if (uploadError) {
            console.error("Upload error:", uploadError);
            throw new Error("Failed to upload training data");
        }

        // Get public URL
        const { data: urlData } = supabaseAdmin.storage
            .from("training-data")
            .getPublicUrl(zipFileName);

        const zipUrl = urlData.publicUrl;
        console.log("ZIP uploaded to:", zipUrl);

        // Step 3: Submit to FAL
        const falResponse = await fetch("https://queue.fal.run/fal-ai/flux-lora-fast-training", {
            method: "POST",
            headers: {
                "Authorization": `Key ${process.env.FAL_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                images_data_url: zipUrl,
                trigger_word: triggerWord,
                steps: 1000,
                create_masks: true,
                is_style: false,
                is_input_format_already_preprocessed: false,
            }),
        });

        const falData = await falResponse.json();
        console.log("FAL Response:", JSON.stringify(falData, null, 2));

        if (!falResponse.ok) {
            throw new Error(falData.detail || falData.message || "FAL training failed");
        }

        if (!falData.request_id) {
            throw new Error("No request_id returned from FAL");
        }

        // Update character status
        await supabaseAdmin
            .from("characters")
            .update({
                status: "training",
                trigger_word: triggerWord,
                job_id: falData.request_id,
                error_message: null,
                updated_at: new Date().toISOString(),
            })
            .eq("id", characterId);

        return NextResponse.json({
            success: true,
            message: "האימון התחיל",
            requestId: falData.request_id,
            triggerWord,
        });

    } catch (error: any) {
        console.error("Training error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}