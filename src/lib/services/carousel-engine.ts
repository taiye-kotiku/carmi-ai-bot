/**
 * SmartTicTakEngine - Node.js port of the original Python carousel generator.
 * Supports: highlighted text (*word*), logos, multiple slide backgrounds (shift),
 * different fonts, adaptive text sizing.
 */
import path from "path";
import fs from "fs";
import sharp from "sharp";
import { createCanvas, loadImage, GlobalFonts, SKRSContext2D } from "@napi-rs/canvas";
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
    fontFamily?: string;
    headlineFontSize?: number;
    bodyFontSize?: number;
    customBackgroundBase64?: string;
}

function getLogoPosition(
    position: LogoPosition,
    logoWidth: number,
    logoHeight: number
): { x: number; y: number } {
    // Progress bar constants
    const PROGRESS_BAR_HEIGHT = 14;
    const PROGRESS_BAR_BOTTOM_MARGIN = 50;
    const PROGRESS_BAR_TOP = HEIGHT - PROGRESS_BAR_BOTTOM_MARGIN - PROGRESS_BAR_HEIGHT; // HEIGHT - 64
    
    // Top position - safe margin from top
    const topY = 60;
    
    // Bottom position - above progress bar with safe gap
    const LOGO_BOTTOM_GAP = 25; // Gap between logo and progress bar
    const bottomY = PROGRESS_BAR_TOP - logoHeight - LOGO_BOTTOM_GAP;
    
    // Horizontal positions
    const leftX = MARGIN;
    const rightX = WIDTH - MARGIN - logoWidth;
    const centerX = (WIDTH - logoWidth) / 2;
    
    // Safety checks for horizontal positions
    const safeLeftX = Math.max(MARGIN, Math.min(leftX, WIDTH - logoWidth - MARGIN));
    const safeRightX = Math.max(MARGIN, Math.min(rightX, WIDTH - logoWidth - MARGIN));
    const safeCenterX = Math.max(MARGIN, Math.min(centerX, WIDTH - logoWidth - MARGIN));
    
    // Safety checks for vertical positions
    const safeTopY = Math.max(0, Math.min(topY, HEIGHT - logoHeight - PROGRESS_BAR_BOTTOM_MARGIN - PROGRESS_BAR_HEIGHT - LOGO_BOTTOM_GAP));
    // Ensure bottom logo doesn't overlap with progress bar or go off-screen
    const minBottomY = topY + logoHeight + 50; // Minimum distance from top
    const maxBottomY = PROGRESS_BAR_TOP - logoHeight - LOGO_BOTTOM_GAP;
    const safeBottomY = Math.max(minBottomY, Math.min(bottomY, maxBottomY));

    const pos: Record<string, { x: number; y: number }> = {
        "top-left": { x: safeLeftX, y: safeTopY },
        "top-right": { x: safeRightX, y: safeTopY },
        "top-middle": { x: safeCenterX, y: safeTopY },
        "bottom-left": { x: safeLeftX, y: safeBottomY },
        "bottom-right": { x: safeRightX, y: safeBottomY },
        "bottom-middle": { x: safeCenterX, y: safeBottomY },
    };
    
    const result = pos[position] || pos["top-right"];
    
    // Final safety check - ensure logo is completely within canvas bounds
    return {
        x: Math.max(0, Math.min(result.x, WIDTH - logoWidth)),
        y: Math.max(0, Math.min(result.y, HEIGHT - logoHeight))
    };
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
    ctx: SKRSContext2D,
    text: string,
    x: number,
    y: number,
    defaultColor: string,
    highlightColor: string,
    fontPath: string,
    headlineFontSize?: number,
    bodyFontSize?: number
) {
    const maxWidth = WIDTH - MARGIN * 2.5;
    const maxHeight = HEIGHT * 0.5;

    let currentFontSize = bodyFontSize || 95;
    const minFontSize = 40;
    const highlightFontSize = headlineFontSize || currentFontSize;

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
        const lineSegments: { text: string; color: string; isHighlight: boolean }[] = [];
        for (let i = 0; i < parts.length; i++) {
            if (!parts[i]) continue;
            const isHighlight = i % 2 !== 0;
            const color = isHighlight ? highlightColor : defaultColor;
            lineSegments.push({ text: parts[i], color, isHighlight });
        }

        // Calculate total width with mixed font sizes
        let totalLineW = 0;
        for (const seg of lineSegments) {
            const fontSize = seg.isHighlight ? highlightFontSize : currentFontSize;
            ctx.font = `bold ${fontSize}px CarouselFont`;
            totalLineW += ctx.measureText(seg.text).width;
        }
        const startX = x + totalLineW / 2; // RTL: anchor at right edge

        // Draw each segment (logical order = right-to-left for Hebrew)
        // Add text shadow for better visibility on any background
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        let offsetX = 0;
        const maxSegmentFontSize = Math.max(...lineSegments.map(s => s.isHighlight ? highlightFontSize : currentFontSize));
        for (const seg of lineSegments) {
            ctx.fillStyle = seg.color;
            const fontSize = seg.isHighlight ? highlightFontSize : currentFontSize;
            ctx.font = `bold ${fontSize}px CarouselFont`;
            const w = ctx.measureText(seg.text).width;
            ctx.fillText(seg.text, startX - offsetX, currentY + maxSegmentFontSize / 2);
            offsetX += w;
        }
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        currentY += maxSegmentFontSize + lineSpacing;
    }
}

/** Draw progress bar (original Python style) */
function drawProgressBar(
    ctx: SKRSContext2D,
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
    ctx: SKRSContext2D,
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
        fontFamily,
        headlineFontSize,
        bodyFontSize,
        customBackgroundBase64,
    } = options;

    // Determine font path based on fontFamily or customFontPath
    let fontPath: string;
    if (customFontPath) {
        fontPath = customFontPath;
    } else if (fontFamily) {
        fontPath = path.join(process.cwd(), `public/fonts/${fontFamily}.ttf`);
    } else {
        fontPath = path.join(process.cwd(), "public/fonts/Assistant-Bold.ttf");
    }
    
    if (!fs.existsSync(fontPath)) {
        console.error(`Font not found: ${fontPath}. Available fonts:`, fs.readdirSync(path.join(process.cwd(), "public/fonts")).join(", "));
        // Fallback to default font
        const defaultFont = path.join(process.cwd(), "public/fonts/Assistant-Bold.ttf");
        if (fs.existsSync(defaultFont)) {
            console.warn(`Using fallback font: ${defaultFont}`);
            fontPath = defaultFont;
        } else {
            throw new Error(`Font not found: ${fontPath} and fallback font also not found`);
        }
    }
    
    try {
        GlobalFonts.registerFromPath(fontPath, "CarouselFont");
    } catch (fontError) {
        console.error(`Failed to register font ${fontPath}:`, fontError);
        throw new Error(`Failed to load font: ${fontError instanceof Error ? fontError.message : String(fontError)}`);
    }

    const total = slides.length;
    const bgTotalW = WIDTH + (total - 1) * SHIFT_PX;

    // Load and prepare wide background
    let bgResized: Buffer;
    let useStaticBackground = false; // Flag to indicate if we should use static (no parallax) background
    
    if (customBackgroundBase64) {
        useStaticBackground = true; // Custom backgrounds should not move
        
        try {
            // Use custom background - resize without cropping, maintain high quality
            if (!customBackgroundBase64 || typeof customBackgroundBase64 !== "string") {
                throw new Error("Invalid custom background base64 data");
            }
            
            // Clean base64 string - handle various formats
            let base64 = customBackgroundBase64.trim();
            if (base64.includes(",")) {
                base64 = base64.split(",")[1]; // Extract base64 part after comma
            } else {
                // Remove data URL prefix if present
                base64 = base64.replace(/^data:image\/\w+;base64,/, "");
            }
            
            if (!base64 || base64.length === 0) {
                throw new Error("Empty base64 string");
            }
            
            const customBgBuffer = Buffer.from(base64, "base64");
            
            if (customBgBuffer.length === 0) {
                throw new Error("Failed to decode base64 image");
            }
            
            // Get original image dimensions
            const metadata = await sharp(customBgBuffer).metadata();
            const originalWidth = metadata.width;
            const originalHeight = metadata.height;
            
            if (!originalWidth || !originalHeight || originalWidth <= 0 || originalHeight <= 0) {
                throw new Error(`Could not read image dimensions: ${originalWidth}x${originalHeight}`);
            }
            
            // For custom backgrounds, resize to exact canvas size (WIDTH x HEIGHT) - no parallax needed
            // Calculate scale to fit within canvas without cropping (maintain aspect ratio)
            const scaleX = WIDTH / originalWidth;
            const scaleY = HEIGHT / originalHeight;
            const scale = Math.min(scaleX, scaleY); // Use smaller scale to fit both dimensions
            
            const newWidth = Math.round(originalWidth * scale);
            const newHeight = Math.round(originalHeight * scale);
            
            // Calculate padding to center the image (ensure non-negative values)
            const padTop = Math.max(0, Math.floor((HEIGHT - newHeight) / 2));
            const padBottom = Math.max(0, HEIGHT - newHeight - padTop);
            const padLeft = Math.max(0, Math.floor((WIDTH - newWidth) / 2));
            const padRight = Math.max(0, WIDTH - newWidth - padLeft);
            
            // Resize with high quality (Lanczos3 kernel for sharp resampling) and add black padding
            // Use exact dimensions to avoid any blur from resampling
            let sharpInstance = sharp(customBgBuffer);
            
            // Only resize if needed (if image is larger than canvas or aspect ratio differs)
            if (originalWidth !== WIDTH || originalHeight !== HEIGHT) {
                sharpInstance = sharpInstance.resize(newWidth, newHeight, {
                    fit: "inside", // Fit inside dimensions without cropping
                    kernel: sharp.kernel.lanczos3, // High quality resampling (no blur)
                    withoutEnlargement: false, // Allow upscaling if needed
                });
            }
            
            // Only extend if padding is needed
            if (padTop > 0 || padBottom > 0 || padLeft > 0 || padRight > 0) {
                sharpInstance = sharpInstance.extend({
                    top: padTop,
                    bottom: padBottom,
                    left: padLeft,
                    right: padRight,
                    background: { r: 0, g: 0, b: 0, alpha: 1 } // Black padding
                });
            }
            
            // Use highest quality PNG settings to prevent blur
            bgResized = await sharpInstance
                .png({ 
                    quality: 100, 
                    compressionLevel: 0, // No compression for maximum quality
                    adaptiveFiltering: true,
                    effort: 10 // Maximum effort for best quality
                })
                .toBuffer();
        } catch (error) {
            console.error("Error processing custom background:", error);
            console.error("Error details:", error instanceof Error ? error.message : String(error));
            
            try {
                // Fallback: use contain fit without extend (static background, no parallax)
                let base64 = customBackgroundBase64.trim();
                if (base64.includes(",")) {
                    base64 = base64.split(",")[1];
                } else {
                    base64 = base64.replace(/^data:image\/\w+;base64,/, "");
                }
                
                const customBgBuffer = Buffer.from(base64, "base64");
                
                if (customBgBuffer.length === 0) {
                    throw new Error("Failed to decode base64 in fallback");
                }
                
                bgResized = await sharp(customBgBuffer)
                    .resize(WIDTH, HEIGHT, {  // Use WIDTH instead of bgTotalW for static background
                        fit: "contain",
                        background: { r: 0, g: 0, b: 0, alpha: 1 },
                        kernel: sharp.kernel.lanczos3 // High quality
                    })
                    .png({
                        quality: 100,
                        compressionLevel: 0,
                        adaptiveFiltering: true
                    })
                    .toBuffer();
            } catch (fallbackError) {
                console.error("Fallback also failed:", fallbackError);
                throw new Error(`Failed to process custom background image: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    } else {
        // Use template background - check if template file exists
        if (!template.file) {
            throw new Error(`Template ${template.id} has no file specified`);
        }
        
        const templatePath = path.join(
            process.cwd(),
            "public/carousel-templates",
            template.file
        );
        
        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template file not found: ${templatePath}`);
        }
        
        // Use template background - keep cover for templates
        bgResized = await sharp(templatePath)
            .resize(bgTotalW, HEIGHT, { fit: "cover" })
            .png()
            .toBuffer();
    }

    // Apply background effects - reduce blur for custom backgrounds to maintain sharpness
    const blurRadius = useStaticBackground ? 0 : 5; // No blur for custom backgrounds
    const opacity = useStaticBackground ? 120 : 165; // Lighter overlay for custom backgrounds
    
    // Verify background dimensions before applying effects
    const bgMetadata = await sharp(bgResized).metadata();
    console.log(`Background dimensions: ${bgMetadata.width}x${bgMetadata.height}, useStaticBackground: ${useStaticBackground}`);
    
    const bgWithEffects = await applyBackgroundEffects(bgResized, opacity, blurRadius, 18);

    const bgImage = await loadImage(bgWithEffects);
    console.log(`Loaded background image: ${bgImage.width}x${bgImage.height}`);
    const images: Buffer[] = [];

    // Load logo if provided
    let logoImage: Awaited<ReturnType<typeof loadImage>> | null = null;
    let logoW = 120;
    let logoH = 120;
    if (logoBuffer && logoBuffer.length > 0) {
        try {
            logoImage = await loadImage(logoBuffer);
            const maxLogo = 260;
            const minLogo = 20; // Minimum logo size
            
            if (logoImage.width > maxLogo || logoImage.height > maxLogo) {
                const scale = Math.min(
                    maxLogo / logoImage.width,
                    maxLogo / logoImage.height
                );
                logoW = Math.max(minLogo, Math.round(logoImage.width * scale));
                logoH = Math.max(minLogo, Math.round(logoImage.height * scale));
            } else {
                logoW = Math.max(minLogo, logoImage.width);
                logoH = Math.max(minLogo, logoImage.height);
            }
            
            // Ensure logo doesn't exceed canvas dimensions
            logoW = Math.min(logoW, WIDTH - MARGIN * 2);
            logoH = Math.min(logoH, HEIGHT - 200); // Leave space for text and progress bar
        } catch (e) {
            console.warn("Could not load logo:", e);
            logoImage = null; // Ensure logoImage is null on error
        }
    }

    for (let i = 0; i < slides.length; i++) {
        const canvas = createCanvas(WIDTH, HEIGHT);
        const ctx = canvas.getContext("2d");

        // Draw background - static for custom backgrounds, parallax for templates
        if (useStaticBackground) {
            // For custom backgrounds: draw the same image for all slides (no movement)
            // Ensure we're drawing the correct portion of the image
            try {
                ctx.drawImage(
                    bgImage,
                    0,
                    0,
                    Math.min(bgImage.width, WIDTH),
                    Math.min(bgImage.height, HEIGHT),
                    0,
                    0,
                    WIDTH,
                    HEIGHT
                );
            } catch (drawError) {
                console.error(`Error drawing static background on slide ${i}:`, drawError);
                // Fallback: try simple draw
                ctx.drawImage(bgImage, 0, 0, WIDTH, HEIGHT);
            }
        } else {
            // For templates: use parallax effect (each slide gets different portion)
            const left = i * SHIFT_PX;
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
        }

        // Draw text (centered, adaptive)
        drawCleanText(
            ctx,
            slides[i],
            WIDTH / 2,
            HEIGHT / 2,
            textColor,
            HIGHLIGHT_COLOR,
            fontPath,
            headlineFontSize,
            bodyFontSize
        );

        // Draw logo (before progress bar to ensure proper layering)
        if (logoImage && logoW > 0 && logoH > 0) {
            try {
                const logoPos = getLogoPosition(logoPosition, logoW, logoH);
                // Ensure logo is within bounds
                const safeX = Math.max(0, Math.min(logoPos.x, WIDTH - logoW));
                const safeY = Math.max(0, Math.min(logoPos.y, HEIGHT - logoH));
                
                // Validate logo dimensions
                if (safeX + logoW <= WIDTH && safeY + logoH <= HEIGHT && logoW > 0 && logoH > 0) {
                    ctx.drawImage(logoImage, safeX, safeY, logoW, logoH);
                } else {
                    console.warn(`Logo position out of bounds: x=${safeX}, y=${safeY}, w=${logoW}, h=${logoH}`);
                }
            } catch (err) {
                console.error("Error drawing logo:", err);
                // Continue without logo rather than failing the entire generation
            }
        }

        // Progress bar (drawn after logo to ensure it's on top)
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
