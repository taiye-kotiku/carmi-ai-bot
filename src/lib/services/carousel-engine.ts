/**
 * SmartTicTakEngine - Node.js port of the original Python carousel generator.
 * Supports: highlighted text (*word*), logos, multiple slide backgrounds (shift),
 * different fonts, adaptive text sizing.
 */
import path from "path";
import fs from "fs";
import sharp from "sharp";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import type { CarouselTemplate } from "@/lib/carousel/templates";

const WIDTH = 1080;
const HEIGHT = 1350;
const MARGIN = 80;
const SHIFT_PX = Math.floor(WIDTH * 0.2); // 216 - parallax between slides
const HIGHLIGHT_COLOR = "#F8FF00";

export type LogoPosition =
    | "top-left"
    | "top-right"
    | "top-middle"
    | "bottom-left"
    | "bottom-right"
    | "bottom-middle";

export interface CarouselEngineOptions {
    slides: string[];
    templateId: string;
    template: CarouselTemplate;
    fontPath?: string;
    logoBuffer?: Buffer;
    logoPosition?: LogoPosition;
    accentColor?: string;
    textColor?: string;
}

function getLogoPosition(
    position: LogoPosition,
    logoWidth: number,
    logoHeight: number
): { x: number; y: number } {
    const topY = 60;
    const bottomY = HEIGHT - 60 - logoHeight;
    const leftX = MARGIN;
    const rightX = WIDTH - MARGIN - logoWidth;
    const centerX = (WIDTH - logoWidth) / 2;

    const pos: Record<string, { x: number; y: number }> = {
        "top-left": { x: leftX, y: topY },
        "top-right": { x: rightX, y: topY },
        "top-middle": { x: centerX, y: topY },
        "bottom-left": { x: leftX, y: bottomY },
        "bottom-right": { x: rightX, y: bottomY },
        "bottom-middle": { x: centerX, y: bottomY },
    };
    return pos[position] || pos["top-right"];
}

/** Apply background effects: blur, scrim overlay, grain. Stronger for text readability. */
async function applyBackgroundEffects(
    buf: Buffer,
    opacity = 165,
    blurRadius = 5,
    grainStrength = 18
): Promise<Buffer> {
    const meta = await sharp(buf).metadata();
    const w = meta.width || WIDTH;
    const h = meta.height || HEIGHT;

    let img = sharp(buf);
    if (blurRadius > 0) {
        img = img.blur(blurRadius);
    }

    const scrimOpacity = opacity / 255;
    const scrimSvg = `<svg width="${w}" height="${h}"><rect width="100%" height="100%" fill="black" opacity="${scrimOpacity}"/></svg>`;
    img = img.composite([{ input: Buffer.from(scrimSvg), blend: "over" }]);

    // Add grain: create noise overlay (8000 random white points)
    const grainPixels = Buffer.alloc(w * h * 4, 0);
    for (let i = 0; i < 8000; i++) {
        const x = Math.floor(Math.random() * w);
        const y = Math.floor(Math.random() * h);
        const idx = (y * w + x) * 4;
        grainPixels[idx] = 255;
        grainPixels[idx + 1] = 255;
        grainPixels[idx + 2] = 255;
        grainPixels[idx + 3] = grainStrength;
    }
    const grainBuf = await sharp(grainPixels, {
        raw: { width: w, height: h, channels: 4 },
    })
        .png()
        .toBuffer();
    img = img.composite([{ input: grainBuf, blend: "over" }]);

    return img.png().toBuffer();
}

/** Draw text with adaptive font size and *highlight* support. Uses logical Hebrew + ctx.direction RTL for correct display. */
function drawCleanText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    defaultColor: string,
    highlightColor: string,
    fontPath: string
) {
    const maxWidth = WIDTH - MARGIN * 2.5;
    const maxHeight = HEIGHT * 0.5;

    let currentFontSize = 95;
    const minFontSize = 40;

    ctx.direction = "rtl";
    ctx.textAlign = "right";

    let lines: string[] = [];
    let lineSpacing = 0;
    let totalH = 0;

    while (currentFontSize >= minFontSize) {
        ctx.font = `${currentFontSize}px CarouselFont`;
        const words = text.split(" ");
        lines = [];
        let currentLine: string[] = [];

        for (const word of words) {
            const testStr = [...currentLine, word].join(" ").replace(/\*/g, "");
            const metrics = ctx.measureText(testStr);
            if (metrics.width <= maxWidth) {
                currentLine.push(word);
            } else {
                if (currentLine.length > 0) {
                    lines.push(currentLine.join(" "));
                }
                currentLine = [word];
            }
        }
        lines.push(currentLine.join(" "));

        lineSpacing = Math.floor(currentFontSize * 0.3);
        totalH =
            lines.length * currentFontSize +
            (lines.length - 1) * lineSpacing;

        if (totalH <= maxHeight) break;
        currentFontSize -= 5;
    }

    ctx.textBaseline = "middle";
    let currentY = y - totalH / 2;

    for (const line of lines) {
        const parts = line.split("*");
        const lineSegments: { text: string; color: string }[] = [];
        for (let i = 0; i < parts.length; i++) {
            if (!parts[i]) continue;
            const color = i % 2 !== 0 ? highlightColor : defaultColor;
            lineSegments.push({ text: parts[i], color });
        }

        const fullCleanLine = lineSegments.map((s) => s.text).join("");
        const totalLineW = ctx.measureText(fullCleanLine).width;
        const startX = x + totalLineW / 2; // RTL: anchor at right edge

        // Draw each segment (logical order = right-to-left for Hebrew)
        // Add text shadow for better visibility on any background
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        let offsetX = 0;
        for (const seg of lineSegments) {
            ctx.fillStyle = seg.color;
            ctx.font = `${currentFontSize}px CarouselFont`;
            const w = ctx.measureText(seg.text).width;
            ctx.fillText(seg.text, startX - offsetX, currentY + currentFontSize / 2);
            offsetX += w;
        }
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        currentY += currentFontSize + lineSpacing;
    }
}

/** Draw progress bar (original Python style) */
function drawProgressBar(
    ctx: CanvasRenderingContext2D,
    current: number,
    total: number,
    accentColor: string
) {
    const h = 14;
    const bottom = 50;
    const side = 100;
    const fullW = WIDTH - side * 2;
    const prog = fullW * ((current + 1) / total);
    const glowMargin = 3;
    const y = HEIGHT - bottom - h;

    ctx.fillStyle = "rgba(34, 197, 94, 0.3)";
    roundRect(ctx, side - glowMargin, y - glowMargin, prog + glowMargin * 2, h + glowMargin * 2, 9);
    ctx.fill();

    ctx.fillStyle = accentColor;
    roundRect(ctx, side, y, prog, h, 5);
    ctx.fill();
}

function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
}

export async function createCarouselWithEngine(
    options: CarouselEngineOptions
): Promise<Buffer[]> {
    const {
        slides,
        templateId,
        template,
        fontPath: customFontPath,
        logoBuffer,
        logoPosition = "top-right",
        accentColor = template.accent,
        textColor = template.text_color,
    } = options;

    const defaultFontPath = path.join(
        process.cwd(),
        "public/fonts/Assistant-Bold.ttf"
    );
    const fontPath = customFontPath || defaultFontPath;

    if (!fs.existsSync(fontPath)) {
        throw new Error(`Font not found: ${fontPath}`);
    }

    GlobalFonts.registerFromPath(fontPath, "CarouselFont");

    const templatePath = path.join(
        process.cwd(),
        "public/carousel-templates",
        template.file
    );
    if (!fs.existsSync(templatePath)) {
        throw new Error(`Template not found: ${templatePath}`);
    }

    const total = slides.length;
    const bgTotalW = WIDTH + (total - 1) * SHIFT_PX;

    // Load and prepare wide background (like Python's ImageOps.fit)
    const bgResized = await sharp(templatePath)
        .resize(bgTotalW, HEIGHT, { fit: "cover" })
        .png()
        .toBuffer();

    const bgWithEffects = await applyBackgroundEffects(bgResized, 165, 5, 18);

    const bgImage = await loadImage(bgWithEffects);
    const images: Buffer[] = [];

    // Load logo if provided
    let logoImage: Awaited<ReturnType<typeof loadImage>> | null = null;
    let logoW = 120;
    let logoH = 120;
    if (logoBuffer && logoBuffer.length > 0) {
        try {
            logoImage = await loadImage(logoBuffer);
            const maxLogo = 260;
            if (logoImage.width > maxLogo || logoImage.height > maxLogo) {
                const scale = Math.min(
                    maxLogo / logoImage.width,
                    maxLogo / logoImage.height
                );
                logoW = Math.round(logoImage.width * scale);
                logoH = Math.round(logoImage.height * scale);
            } else {
                logoW = logoImage.width;
                logoH = logoImage.height;
            }
        } catch (e) {
            console.warn("Could not load logo:", e);
        }
    }

    for (let i = 0; i < slides.length; i++) {
        const left = i * SHIFT_PX;
        const canvas = createCanvas(WIDTH, HEIGHT);
        const ctx = canvas.getContext("2d");

        // Draw cropped background (each slide gets different portion)
        ctx.drawImage(
            bgImage,
            left,
            0,
            WIDTH,
            HEIGHT,
            0,
            0,
            WIDTH,
            HEIGHT
        );

        // Draw text (centered, adaptive)
        drawCleanText(
            ctx,
            slides[i],
            WIDTH / 2,
            HEIGHT / 2,
            textColor,
            HIGHLIGHT_COLOR,
            fontPath
        );

        // Draw logo
        if (logoImage) {
            const logoPos = getLogoPosition(logoPosition, logoW, logoH);
            ctx.drawImage(logoImage, logoPos.x, logoPos.y, logoW, logoH);
        }

        // Progress bar
        drawProgressBar(ctx, i, total, accentColor);

        // Counter (top-left like original)
        ctx.font = "42px CarouselFont";
        ctx.fillStyle = accentColor;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.direction = "ltr";
        ctx.fillText(`${i + 1} / ${total}`, MARGIN + 10, 85);

        images.push(canvas.encodeSync("png"));
    }

    return images;
}
