export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { CAROUSEL_TEMPLATES } from "@/lib/carousel/templates";
import { deductCredits } from "@/lib/services/credits";
import { CREDIT_COSTS } from "@/lib/config/credits";

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
            logo_transparent = false,
            font_family,
            headline_font_size,
            body_font_size,
            font_color,
            custom_background_base64,
        } = body;

        if (!topic && !customSlides?.length) {
            return NextResponse.json(
                { error: "נא להזין נושא או תוכן לשקופיות" },
                { status: 400 }
            );
        }

        if (!template_id || (template_id !== "custom" && !CAROUSEL_TEMPLATES[template_id])) {
            if (template_id !== "custom") {
                const fs = require("fs");
                const path = require("path");
                const templatePath = path.join(process.cwd(), "public/carousel-templates", `${template_id}.jpg`);
                const templatePathPng = path.join(process.cwd(), "public/carousel-templates", `${template_id}.png`);
                if (!fs.existsSync(templatePath) && !fs.existsSync(templatePathPng)) {
                    return NextResponse.json({ error: "נא לבחור תבנית" }, { status: 400 });
                }
            }
        }

        if (template_id === "custom" && !custom_background_base64) {
            return NextResponse.json(
                { error: "נא להעלות תמונת רקע מותאמת אישית" },
                { status: 400 }
            );
        }

        // Deduct credits (carousel is free when carousel_generation cost is 0)
        if (CREDIT_COSTS.carousel_generation > 0) {
            try {
                await deductCredits(user.id, "carousel_generation");
            } catch (err) {
                return NextResponse.json(
                    { error: (err as Error).message, code: "INSUFFICIENT_CREDITS" },
                    { status: 402 }
                );
            }
        }

        // Get brand logo if needed
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

        // Create job with ALL params stored
        const jobId = nanoid();
        await supabaseAdmin.from("jobs").insert({
            id: jobId,
            user_id: user.id,
            type: "carousel",
            status: "processing",
            progress: 5,
            result: {
                params: {
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
                    logoTransparent: logo_transparent || false,
                    fontFamily: font_family,
                    headlineFontSize: headline_font_size,
                    bodyFontSize: body_font_size,
                    fontColor: font_color,
                    customBackgroundBase64: custom_background_base64,
                },
            },
        });

        // Return immediately
        return NextResponse.json({ jobId });
    } catch (error) {
        console.error("Carousel error:", error);
        return NextResponse.json({ error: "שגיאה בשרת" }, { status: 500 });
    }
}