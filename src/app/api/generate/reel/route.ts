import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { isValidInstagramUrl } from "@/lib/utils";
import { extractReelFrames } from "@/lib/services/reel-extractor";
import sharp from "sharp";

// Define types for better type safety
interface ExtractedFrame {
    url: string;
    timestamp: number;
}

interface UploadedFrame {
    url: string;
    timestamp: number;
    [key: string]: string | number; // Add index signature for Json compatibility
}

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { url } = await req.json();

        // Validate URL
        if (!isValidInstagramUrl(url)) {
            return NextResponse.json(
                { error: "קישור אינסטגרם לא תקין" },
                { status: 400 }
            );
        }

        // Check credits
        const { data: credits } = await supabase
            .from("credits")
            .select("reel_credits")
            .eq("user_id", user.id)
            .single();

        if (!credits || credits.reel_credits < 1) {
            return NextResponse.json(
                { error: "אין מספיק קרדיטים להמרת רילז" },
                { status: 402 }
            );
        }

        // Create job record
        const jobId = nanoid();
        await supabaseAdmin.from("jobs").insert({
            id: jobId,
            user_id: user.id,
            type: "convert_reel",
            status: "pending",
            progress: 0,
        });

        // Start background processing
        processReelConversion(jobId, user.id, url);

        return NextResponse.json({ jobId });
    } catch (error) {
        console.error("Reel conversion error:", error);
        return NextResponse.json(
            { error: "שגיאה בשרת" },
            { status: 500 }
        );
    }
}

// Background processing function
async function processReelConversion(
    jobId: string,
    userId: string,
    url: string
) {
    try {
        // Update status to processing
        await supabaseAdmin
            .from("jobs")
            .update({ status: "processing", progress: 10 })
            .eq("id", jobId);

        // Download video and extract best quality frames
        console.log(`[Reel ${jobId}] Starting frame extraction for: ${url}`);
        await supabaseAdmin
            .from("jobs")
            .update({ progress: 20 })
            .eq("id", jobId);

        const extractedFrames = await extractReelFrames(url, 10);
        console.log(`[Reel ${jobId}] Extracted ${extractedFrames.length} frames`);

        await supabaseAdmin
            .from("jobs")
            .update({ progress: 50 })
            .eq("id", jobId);

        const frames: ExtractedFrame[] = extractedFrames;

        // ✅ FIX: Add type annotation here
        const uploadedFrames: UploadedFrame[] = [];

        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            
            // Handle base64 data URLs or regular URLs
            let buffer: Buffer;
            if (frame.url.startsWith("data:image")) {
                // Extract base64 from data URL
                const base64Data = frame.url.split(",")[1];
                buffer = Buffer.from(base64Data, "base64");
            } else {
                // Fetch from URL
                const frameResponse = await fetch(frame.url);
                const blob = await frameResponse.blob();
                const arrayBuffer = await blob.arrayBuffer();
                buffer = Buffer.from(arrayBuffer);
            }
            
            // Ensure image is high quality (1080x1080 if possible)
            try {
                const metadata = await sharp(buffer).metadata();
                if (metadata.width && metadata.height && (metadata.width < 1080 || metadata.height < 1080)) {
                    buffer = await sharp(buffer)
                        .resize(1080, 1080, { fit: "cover", position: "center" })
                        .jpeg({ quality: 95 })
                        .toBuffer();
                } else {
                    // Just optimize quality
                    buffer = await sharp(buffer)
                        .jpeg({ quality: 95 })
                        .toBuffer();
                }
            } catch (sharpError) {
                console.warn(`Failed to process frame ${i + 1}:`, sharpError);
                // Continue with original buffer
            }

            const fileName = `${userId}/${jobId}/frame_${i + 1}.jpg`;
            const { error: uploadError } = await supabaseAdmin.storage
                .from("content")
                .upload(fileName, buffer, {
                    contentType: "image/jpeg",
                    upsert: true,
                });

            if (uploadError) {
                console.error("Upload error:", uploadError);
                continue;
            }

            const { data: urlData } = supabaseAdmin.storage
                .from("content")
                .getPublicUrl(fileName);

            uploadedFrames.push({
                url: urlData.publicUrl,
                timestamp: frame.timestamp,
            });

            // Update progress
            const progress = 50 + Math.round((i / frames.length) * 40);
            await supabaseAdmin
                .from("jobs")
                .update({ progress })
                .eq("id", jobId);
        }

        // Save generation record
        const generationId = nanoid();
        await supabaseAdmin.from("generations").insert({
            id: generationId,
            user_id: userId,
            type: "reel",
            feature: "convert_reel",
            source_url: url,
            result_urls: uploadedFrames.map((f) => f.url),
            thumbnail_url: uploadedFrames[0]?.url,
            status: "completed",
            job_id: jobId,
            completed_at: new Date().toISOString(),
        });

        // Deduct credit
        const { data: currentCredits } = await supabaseAdmin
            .from("credits")
            .select("reel_credits")
            .eq("user_id", userId)
            .single();

        const newBalance = (currentCredits?.reel_credits || 1) - 1;

        await supabaseAdmin
            .from("credits")
            .update({ reel_credits: newBalance })
            .eq("user_id", userId);

        // Record transaction
        await supabaseAdmin.from("credit_transactions").insert({
            user_id: userId,
            credit_type: "reel",
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
                result: { frames: uploadedFrames } as any,
            })
            .eq("id", jobId);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Processing error:", error);
        await supabaseAdmin
            .from("jobs")
            .update({
                status: "failed",
                error: errorMessage,
            })
            .eq("id", jobId);
    }
}