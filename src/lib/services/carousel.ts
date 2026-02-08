// src/lib/services/carousel.ts
import { CarouselTemplate, CAROUSEL_TEMPLATES } from "@/lib/carousel/templates";
import { createCarouselWithEngine } from "./carousel-engine";

export type LogoPosition =
    | "top-left"
    | "top-right"
    | "top-middle"
    | "bottom-left"
    | "bottom-right"
    | "bottom-middle";

interface GenerateCarouselOptions {
    slides: string[];
    templateId: string;
    logoUrl?: string;
    logoBase64?: string;
    brandColor?: string;
    logoPosition?: LogoPosition;
    fontPath?: string;
    fontFamily?: string;
    headlineFontSize?: number;
    bodyFontSize?: number;
    fontColor?: string;
}

interface CarouselResult {
    images: Buffer[];
    template: CarouselTemplate;
}

export async function generateCarousel(options: GenerateCarouselOptions): Promise<CarouselResult> {
    const {
        slides,
        templateId,
        logoUrl,
        logoBase64,
        brandColor,
        logoPosition = "top-right",
        fontPath,
        fontFamily,
        headlineFontSize,
        bodyFontSize,
        fontColor,
    } = options;

    const template = CAROUSEL_TEMPLATES[templateId];
    if (!template) {
        throw new Error(`Template ${templateId} not found`);
    }

    const accentColor = brandColor || template.accent;

    let logoBuffer: Buffer | undefined;
    if (logoBase64) {
        const base64 = logoBase64.replace(/^data:image\/\w+;base64,/, "");
        logoBuffer = Buffer.from(base64, "base64");
    } else if (logoUrl) {
        try {
            const res = await fetch(logoUrl);
            logoBuffer = Buffer.from(await res.arrayBuffer());
        } catch (e) {
            console.warn("Could not fetch logo:", e);
        }
    }

    const images = await createCarouselWithEngine({
        slides,
        templateId,
        template,
        fontPath,
        logoBuffer,
        logoPosition,
        accentColor,
        textColor: fontColor || template.text_color,
        fontFamily,
        headlineFontSize,
        bodyFontSize,
    });

    return { images, template };
}
