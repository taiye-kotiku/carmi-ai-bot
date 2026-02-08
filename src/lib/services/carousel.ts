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
    customBackgroundBase64?: string;
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
        customBackgroundBase64,
    } = options;

    // Handle custom background or auto-registered templates
    let template: CarouselTemplate;
    if (templateId === "custom" && customBackgroundBase64) {
        // Create a temporary template for custom background
        template = {
            id: "custom",
            style: "Custom Background",
            file: "", // Not used for custom backgrounds
            text_color: fontColor || "#FFFFFF",
            accent: brandColor || "#2563EB",
            y_pos: 675,
            category: "abstract",
        };
    } else {
        template = CAROUSEL_TEMPLATES[templateId];
        if (!template) {
            // Auto-register template if file exists
            const fs = require("fs");
            const path = require("path");
            const templatePathJpg = path.join(process.cwd(), "public/carousel-templates", `${templateId}.jpg`);
            const templatePathPng = path.join(process.cwd(), "public/carousel-templates", `${templateId}.png`);
            const file = fs.existsSync(templatePathJpg) ? `${templateId}.jpg` : 
                        fs.existsSync(templatePathPng) ? `${templateId}.png` : null;
            
            if (!file) {
                throw new Error(`Template ${templateId} not found`);
            }
            
            // Auto-create template entry
            let category: CarouselTemplate["category"] = "abstract";
            if (templateId.startsWith("T_")) {
                const num = parseInt(templateId.replace("T_", ""));
                if (num >= 96 && num <= 144) category = "nature";
                else if (num >= 20 && num <= 30) category = "gradient";
                else if (num >= 60 && num <= 80) category = "tech";
            }
            
            template = {
                id: templateId,
                style: templateId,
                file,
                text_color: category === "dark" ? "#FFFFFF" : "#1A1A1A",
                accent: category === "dark" ? "#60A5FA" : "#2563EB",
                y_pos: 675,
                category,
            };
        }
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
        customBackgroundBase64,
    });

    return { images, template };
}
