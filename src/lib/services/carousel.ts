// src/lib/services/carousel.ts
import { createCanvas, loadImage, GlobalFonts, CanvasRenderingContext2D } from "@napi-rs/canvas";
import path from "path";
import { CarouselTemplate, CAROUSEL_TEMPLATES } from "@/lib/carousel/templates";

// Register Hebrew font - put your font file in public/fonts/
const FONT_PATH = path.join(process.cwd(), "public/fonts/Assistant-Bold.ttf");

try {
    GlobalFonts.registerFromPath(FONT_PATH, "Assistant");
} catch (e) {
    console.warn("Could not register custom font, using default");
}

const WIDTH = 1080;
const HEIGHT = 1350;
const MARGIN = 80;

interface GenerateCarouselOptions {
    slides: string[];
    templateId: string;
    logoUrl?: string;
    brandColor?: string;
}

interface CarouselResult {
    images: Buffer[];
    template: CarouselTemplate;
}

export async function generateCarousel(options: GenerateCarouselOptions): Promise<CarouselResult> {
    const { slides, templateId, logoUrl, brandColor } = options;

    const template = CAROUSEL_TEMPLATES[templateId];
    if (!template) {
        throw new Error(`Template ${templateId} not found`);
    }

    // Override accent color if brand color provided
    const accentColor = brandColor || template.accent;

    const images: Buffer[] = [];
    const total = slides.length;

    // Load template background
    const templatePath = path.join(process.cwd(), "public/carousel-templates", template.file);
    let backgroundImage;

    try {
        backgroundImage = await loadImage(templatePath);
    } catch {
        // Fallback to solid color if template image not found
        backgroundImage = null;
    }

    // Load logo if provided
    let logoImage: any = null;
    if (logoUrl) {
        try {
            logoImage = await loadImage(logoUrl);
        } catch {
            console.warn("Could not load logo");
        }
    }

    for (let i = 0; i < slides.length; i++) {
        const slideBuffer = await generateSlide({
            text: slides[i],
            slideIndex: i,
            totalSlides: total,
            template,
            accentColor,
            backgroundImage,
            logoImage,
        });
        images.push(slideBuffer);
    }

    return { images, template };
}

interface GenerateSlideOptions {
    text: string;
    slideIndex: number;
    totalSlides: number;
    template: CarouselTemplate;
    accentColor: string;
    backgroundImage: any;
    logoImage: any;
}

async function generateSlide(options: GenerateSlideOptions): Promise<Buffer> {
    const { text, slideIndex, totalSlides, template, accentColor, backgroundImage, logoImage } = options;

    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    // 1. Draw background
    if (backgroundImage) {
        ctx.drawImage(backgroundImage, 0, 0, WIDTH, HEIGHT);
    } else {
        // Fallback gradient
        const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
        gradient.addColorStop(0, "#1a1a2e");
        gradient.addColorStop(1, "#16213e");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    // 2. Add dark overlay for white text templates
    if (template.text_color === "#FFFFFF") {
        ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    // 3. Draw text with protection box
    drawProtectedText(ctx, text, template);

    // 4. Draw logo
    if (logoImage) {
        const logoSize = 120;
        const logoX = WIDTH - MARGIN - logoSize;
        const logoY = 60;
        ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);
    }

    // 5. Draw progress bar
    drawProgressBar(ctx, slideIndex, totalSlides, accentColor, template);

    // 6. Draw slide counter
    drawSlideCounter(ctx, slideIndex, totalSlides, accentColor);

    return canvas.toBuffer("image/png");
}

function drawProtectedText(ctx: CanvasRenderingContext2D, text: string, template: CarouselTemplate) {
    ctx.font = "bold 85px Assistant, Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.direction = "rtl";

    const maxWidth = WIDTH - MARGIN * 2 - 100;
    const lines = wrapText(ctx, text, maxWidth);
    const lineHeight = 110;
    const totalTextHeight = lines.length * lineHeight;

    const x = WIDTH - MARGIN;
    const y = template.y_pos;

    // Calculate text bounds for protection box
    const boxPadding = 30;
    const boxX = MARGIN - boxPadding;
    const boxY = y - boxPadding;
    const boxWidth = WIDTH - MARGIN * 2 + boxPadding * 2;
    const boxHeight = totalTextHeight + boxPadding * 2;

    // Draw protection box
    const isWhiteText = template.text_color === "#FFFFFF";
    ctx.fillStyle = isWhiteText ? "rgba(0, 0, 0, 0.5)" : "rgba(255, 255, 255, 0.7)";
    roundRect(ctx, boxX, boxY, boxWidth, boxHeight, 20);
    ctx.fill();

    // Draw text
    ctx.fillStyle = template.text_color;
    lines.forEach((line, index) => {
        ctx.fillText(line, x, y + index * lineHeight);
    });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }

    if (currentLine) {
        lines.push(currentLine);
    }

    return lines;
}

function drawProgressBar(
    ctx: CanvasRenderingContext2D,
    currentIndex: number,
    total: number,
    accentColor: string,
    template: CarouselTemplate
) {
    const barHeight = 12;
    const bottomPadding = 40;
    const sidePadding = 100;

    const barY = HEIGHT - bottomPadding - barHeight;
    const barWidth = WIDTH - sidePadding * 2;

    // Determine track color based on template
    const isWhiteText = template.text_color === "#FFFFFF";
    const trackColor = isWhiteText ? "rgba(200, 200, 200, 0.3)" : "rgba(50, 50, 50, 0.2)";

    // Draw track
    ctx.fillStyle = trackColor;
    roundRect(ctx, sidePadding, barY, barWidth, barHeight, 6);
    ctx.fill();

    // Draw progress
    const progressWidth = barWidth * ((currentIndex + 1) / total);
    ctx.fillStyle = accentColor;
    roundRect(ctx, sidePadding, barY, progressWidth, barHeight, 6);
    ctx.fill();
}

function drawSlideCounter(
    ctx: CanvasRenderingContext2D,
    currentIndex: number,
    total: number,
    accentColor: string
) {
    ctx.font = "bold 36px Assistant, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.direction = "ltr";

    const counterText = `${currentIndex + 1} / ${total}`;
    const x = WIDTH / 2;
    const y = 80;

    // Draw background pill
    const metrics = ctx.measureText(counterText);
    const pillPadding = 15;
    const pillWidth = metrics.width + pillPadding * 2;
    const pillHeight = 44;

    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    roundRect(ctx, x - pillWidth / 2, y - pillHeight / 2, pillWidth, pillHeight, 22);
    ctx.fill();

    // Draw text
    ctx.fillStyle = accentColor;
    ctx.fillText(counterText, x, y);
}

function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}