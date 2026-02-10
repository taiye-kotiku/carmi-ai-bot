
// src/app/api/generate/carousel/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // recommended, since you hit DB + auth

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { generateCarousel } from "@/lib/services/carousel";
import { generateCarouselContent } from "@/lib/services/carousel-content";
import { CAROUSEL_TEMPLATES } from "@/lib/carousel/templates";


export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const {
            topic,
            slides: customSlides,
            template_id,
            slide_count = 5,
            style = "educational",
            use_brand = false,
            logo_url: customLogoUrl,
            logo_base64: logoBase64,
            logo_position = "top-right",
            logo_size,
            font_family,
            headline_font_size,
            body_font_size,
            font_color,
            custom_background_base64,
        } = body;

        // Validate
        if (!topic && !customSlides?.length) {
            return NextResponse.json(
                { error: "נא להזין נושא או תוכן לשקופיות" },
                { status: 400 }
            );
        }

        // Allow "custom" template if custom_background_base64 is provided
        // Also allow any template_id that exists as a file (auto-registered templates)
        if (!template_id || (template_id !== "custom" && !CAROUSEL_TEMPLATES[template_id])) {
            // Check if template file exists (for auto-registered templates)
            if (template_id !== "custom") {
                const fs = require("fs");
                const path = require("path");
                const templatePath = path.join(
                    process.cwd(),
                    "public/carousel-templates",
                    `${template_id}.jpg`
                );
                const templatePathPng = path.join(
                    process.cwd(),
                    "public/carousel-templates",
                    `${template_id}.png`
                );
                if (!fs.existsSync(templatePath) && !fs.existsSync(templatePathPng)) {
                    return NextResponse.json(
                        { error: "נא לבחור תבנית" },
                        { status: 400 }
                    );
                }
            }
        }
        
        if (template_id === "custom" && !custom_background_base64) {
            return NextResponse.json(
                { error: "נא להעלות תמונת רקע מותאמת אישית" },
                { status: 400 }
            );
        }

        // Check credits
        const { data: credits } = await supabase
            .from("credits")
            .select("carousel_credits")
            .eq("user_id", user.id)
            .single();

        const requiredCredits = 3; // Fixed cost: 3 credits per carousel
        if (!credits || credits.carousel_credits < requiredCredits) {
            return NextResponse.json(
                { error: `אין מספיק קרדיטים (נדרשים ${requiredCredits})` },
                { status: 402 }
            );
        }

        // Get logo: custom upload (URL or base64), or from brand
        let brandLogo: string | undefined = customLogoUrl;
        let brandColor: string | undefined;
        let logoPosition = logo_position;

        if (!brandLogo && use_brand) {
            const { data: brand } = await supabase
                .from("brands")
                .select("logo_url, primary_color, logo_position, is_enabled")
                .eq("user_id", user.id)
                .eq("is_enabled", true)
                .single();

            if (brand) {
                brandLogo = brand.logo_url || undefined;
                brandColor = brand.primary_color || undefined;
                if (brand.logo_position) logoPosition = brand.logo_position;
            }
        }

        // Create job
        const jobId = nanoid();
        await supabaseAdmin.from("jobs").insert({
            id: jobId,
            user_id: user.id,
            type: "carousel",
            status: "pending",
            progress: 0,
        });

        // Process in background
        processCarousel(jobId, user.id, {
            topic,
            customSlides,
            templateId: template_id,
            slideCount: slide_count,
            style,
            brandLogo,
            logoBase64,
            brandColor,
            logoPosition,
            logoSize: logo_size || "medium",
            requiredCredits,
            fontFamily: font_family,
            headlineFontSize: headline_font_size,
            bodyFontSize: body_font_size,
            fontColor: font_color,
            customBackgroundBase64: custom_background_base64,
        });

        return NextResponse.json({ jobId });
    } catch (error) {
        console.error("Carousel error:", error);
        return NextResponse.json({ error: "שגיאה בשרת" }, { status: 500 });
    }
}

interface ProcessOptions {
    topic?: string;
    customSlides?: string[];
    templateId: string;
    slideCount: number;
    style: string;
    brandLogo?: string;
    logoBase64?: string;
    brandColor?: string;
    logoPosition?: string;
    logoSize?: "small" | "medium" | "large";
    requiredCredits: number;
    fontFamily?: string;
    headlineFontSize?: number;
    bodyFontSize?: number;
    fontColor?: string;
    customBackgroundBase64?: string;
}

async function processCarousel(jobId: string, userId: string, options: ProcessOptions) {
    try {
        console.log(`[Carousel ${jobId}] Starting generation with template: ${options.templateId}`);
        await supabaseAdmin
            .from("jobs")
            .update({ status: "processing", progress: 10 })
            .eq("id", jobId);

        // Generate content if not provided
        let slides = options.customSlides;

        if (!slides?.length && options.topic) {
            console.log(`[Carousel ${jobId}] Generating content for topic: ${options.topic}`);
            await supabaseAdmin
                .from("jobs")
                .update({ progress: 20 })
                .eq("id", jobId);

            try {
                slides = await generateCarouselContent({
                    topic: options.topic,
                    slideCount: options.slideCount,
                    style: options.style as any,
                    language: "he",
                });
                console.log(`[Carousel ${jobId}] Generated ${slides?.length || 0} slides`);
            } catch (contentError) {
                console.error(`[Carousel ${jobId}] Content generation failed:`, contentError);
                throw new Error(`Failed to generate content: ${contentError instanceof Error ? contentError.message : String(contentError)}`);
            }
        }

        if (!slides?.length) {
            throw new Error("No slides content - provide topic or custom slides");
        }

        console.log(`[Carousel ${jobId}] Processing ${slides.length} slides`);
        await supabaseAdmin
            .from("jobs")
            .update({ progress: 40 })
            .eq("id", jobId);

        // Generate carousel images
        console.log(`[Carousel ${jobId}] Generating images with template: ${options.templateId}`);
        let result;
        try {
            result = await generateCarousel({
                slides,
                templateId: options.templateId,
                logoUrl: options.brandLogo,
                logoBase64: options.logoBase64,
                brandColor: options.brandColor,
                logoPosition: options.logoPosition as any,
                logoSize: options.logoSize,
                fontFamily: options.fontFamily,
                headlineFontSize: options.headlineFontSize,
                bodyFontSize: options.bodyFontSize,
                fontColor: options.fontColor,
                customBackgroundBase64: options.customBackgroundBase64,
            });
            console.log(`[Carousel ${jobId}] Generated ${result.images.length} images`);
        } catch (imageError) {
            console.error(`[Carousel ${jobId}] Image generation failed:`, imageError);
            throw new Error(`Failed to generate images: ${imageError instanceof Error ? imageError.message : String(imageError)}`);
        }

        await supabaseAdmin
            .from("jobs")
            .update({ progress: 70 })
            .eq("id", jobId);

        // Upload images to Supabase Storage
        const uploadedUrls: string[] = [];

        for (let i = 0; i < result.images.length; i++) {
            const fileName = `${userId}/${jobId}/slide_${i + 1}.png`;

            const { error: uploadError } = await supabaseAdmin.storage
                .from("content")
                .upload(fileName, result.images[i], {
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
            type: "carousel",
            feature: "carousel_generation",
            prompt: options.topic || slides.join(" | "),
            result_urls: uploadedUrls,
            thumbnail_url: uploadedUrls[0],
            status: "completed",
            job_id: jobId,
            has_branding: !!options.brandLogo,
            completed_at: new Date().toISOString(),
        });

        // Deduct credits
        const { data: currentCredits } = await supabaseAdmin
            .from("credits")
            .select("carousel_credits")
            .eq("user_id", userId)
            .single();

        const newBalance = (currentCredits?.carousel_credits || options.requiredCredits) - options.requiredCredits;

        await supabaseAdmin
            .from("credits")
            .update({ carousel_credits: newBalance })
            .eq("user_id", userId);

        await supabaseAdmin.from("credit_transactions").insert({
            user_id: userId,
            credit_type: "carousel",
            amount: -options.requiredCredits,
            balance_after: newBalance,
            reason: "carousel_generation",
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
                    slides,
                    template: options.templateId,
                },
            })
            .eq("id", jobId);

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        const errorStack = error instanceof Error ? error.stack : String(error);
        console.error(`[Carousel ${jobId}] Processing error:`, errorMessage);
        console.error(`[Carousel ${jobId}] Stack:`, errorStack);
        
        try {
            await supabaseAdmin
                .from("jobs")
                .update({ 
                    status: "failed", 
                    error: errorMessage,
                    progress: 0
                })
                .eq("id", jobId);
            
            // Refund credits on failure
            const { data: currentCredits } = await supabaseAdmin
                .from("credits")
                .select("carousel_credits")
                .eq("user_id", userId)
                .single();
            
            if (currentCredits) {
                const refundedBalance = (currentCredits.carousel_credits || 0) + options.requiredCredits;
                await supabaseAdmin
                    .from("credits")
                    .update({ carousel_credits: refundedBalance })
                    .eq("user_id", userId);
                
                await supabaseAdmin.from("credit_transactions").insert({
                    user_id: userId,
                    credit_type: "carousel",
                    amount: options.requiredCredits,
                    balance_after: refundedBalance,
                    reason: "carousel_generation_failed_refund",
                    related_id: jobId
                });
            }
        } catch (dbError) {
            console.error(`[Carousel ${jobId}] Failed to update job status:`, dbError);
        }
    }
}