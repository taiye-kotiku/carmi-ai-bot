// Test route - bypasses auth & Supabase for carousel testing
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { generateCarousel } from "@/lib/services/carousel";
import { generateCarouselContent } from "@/lib/services/carousel-content";
import { CAROUSEL_TEMPLATES } from "@/lib/carousel/templates";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const {
            topic,
            slides: customSlides,
            template_id,
            slide_count = 5,
            style = "educational",
            logo_url: customLogoUrl,
            logo_base64: logoBase64,
            logo_position = "top-right",
        } = body;

        if (!topic && !customSlides?.length) {
            return NextResponse.json(
                { error: "נא להזין נושא או תוכן לשקופיות" },
                { status: 400 }
            );
        }

        if (!template_id || !CAROUSEL_TEMPLATES[template_id]) {
            return NextResponse.json(
                { error: "נא לבחור תבנית" },
                { status: 400 }
            );
        }

        let slides = customSlides;
        if (!slides?.length && topic) {
            if (!process.env.GOOGLE_AI_API_KEY) {
                return NextResponse.json(
                    { error: "GOOGLE_AI_API_KEY חסר ב-.env.local. השתמש ב'טען דוגמה' או במצב כתיבה ידנית." },
                    { status: 500 }
                );
            }
            slides = await generateCarouselContent({
                topic,
                slideCount: slide_count,
                style: style as any,
                language: "he",
            });
        }

        if (!slides?.length) {
            return NextResponse.json({ error: "לא נוצר תוכן לשקופיות" }, { status: 400 });
        }

        const result = await generateCarousel({
            slides,
            templateId: template_id,
            logoUrl: customLogoUrl,
            logoBase64,
            logoPosition: logo_position as any,
        });

        const imagesBase64 = result.images.map((buf) => buf.toString("base64"));

        return NextResponse.json({
            images: imagesBase64.map((b) => `data:image/png;base64,${b}`),
            slides,
        });
    } catch (error) {
        console.error("Carousel test error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "שגיאה ביצירת קרוסלה" },
            { status: 500 }
        );
    }
}
