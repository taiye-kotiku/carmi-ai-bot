/**
 * Renders carousel slide text using HTML - native RTL + span highlighting.
 * Uses node-html-to-image (Puppeteer) for correct Hebrew text rendering.
 */
import nodeHtmlToImage from "node-html-to-image";
import path from "path";
import fs from "fs";
import type { CarouselTemplate } from "@/lib/carousel/templates";
type LogoPosition = "top-left" | "top-right" | "top-middle" | "bottom-left" | "bottom-right" | "bottom-middle";

const WIDTH = 1080;
const HEIGHT = 1350;
const MARGIN = 80;
const HIGHLIGHT_COLOR = "#F8FF00";

function textToHtml(text: string, textColor: string): string {
    const parts = text.split("*");
    const spans: string[] = [];
    for (let i = 0; i < parts.length; i++) {
        if (parts[i]) {
            const color = i % 2 === 1 ? HIGHLIGHT_COLOR : textColor;
            const escaped = escapeHtml(parts[i]).replace(/\n/g, "<br>");
            spans.push(`<span style="color:${color}">${escaped}</span>`);
        }
    }
    return spans.join("");
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function getLogoPosition(position: LogoPosition, logoSize: number): { top: string; left: string } {
    const topY = 60;
    const bottomY = HEIGHT - 60 - logoSize;
    const leftX = MARGIN;
    const rightX = WIDTH - MARGIN - logoSize;
    const centerX = (WIDTH - logoSize) / 2;

    const pos: Record<string, { top: string; left: string }> = {
        "top-left": { top: `${topY}px`, left: `${leftX}px` },
        "top-right": { top: `${topY}px`, left: `${rightX}px` },
        "top-middle": { top: `${topY}px`, left: `${centerX}px` },
        "bottom-left": { top: `${bottomY}px`, left: `${leftX}px` },
        "bottom-right": { top: `${bottomY}px`, left: `${rightX}px` },
        "bottom-middle": { top: `${bottomY}px`, left: `${centerX}px` },
    };
    return pos[position] || pos["top-right"];
}

export interface RenderSlideHtmlOptions {
    text: string;
    template: CarouselTemplate;
    accentColor: string;
    templateDataUri: string;
    logoDataUri?: string;
    logoPosition: LogoPosition;
    slideIndex: number;
    totalSlides: number;
}

export async function renderSlideHtml(options: RenderSlideHtmlOptions): Promise<Buffer> {
    const {
        text,
        template,
        accentColor,
        templateDataUri,
        logoDataUri,
        logoPosition,
        slideIndex,
        totalSlides,
    } = options;

    const textHtml = textToHtml(text, template.text_color);
    const logoPos = getLogoPosition(logoPosition, 120);
    const hasOverlay = template.text_color === "#FFFFFF";
    const trackColor = hasOverlay ? "rgba(200, 200, 200, 0.3)" : "rgba(50, 50, 50, 0.2)";
    const progressPct = ((slideIndex + 1) / totalSlides) * 100;

    const html = `
<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Assistant:wght@700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: ${WIDTH}px;
      height: ${HEIGHT}px;
      font-family: 'Assistant', Arial, sans-serif;
      overflow: hidden;
      position: relative;
    }
    .bg {
      position: absolute;
      inset: 0;
      ${templateDataUri ? `background-image: url('${templateDataUri}'); background-size: cover;` : "background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);"}
    }
    .overlay {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.3);
      pointer-events: none;
    }
    .text {
      position: absolute;
      top: ${template.y_pos}px;
      left: ${MARGIN}px;
      right: ${MARGIN}px;
      max-height: ${HEIGHT - template.y_pos - 120}px;
      overflow: hidden;
      font-size: 72px;
      font-weight: bold;
      line-height: 1.3;
      text-align: right;
      direction: rtl;
      white-space: pre-wrap;
      word-wrap: break-word;
      word-break: break-word;
    }
    .logo {
      position: absolute;
      width: 120px;
      height: 120px;
      top: ${logoPos.top};
      left: ${logoPos.left};
      object-fit: contain;
    }
    .progress-track {
      position: absolute;
      bottom: 40px;
      left: 100px;
      right: 100px;
      height: 12px;
      background: ${trackColor};
      border-radius: 6px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      width: ${progressPct}%;
      background: ${accentColor};
      border-radius: 6px;
      transition: width 0.3s;
    }
    .counter {
      position: absolute;
      top: 58px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.4);
      color: ${accentColor};
      padding: 10px 20px;
      border-radius: 22px;
      font-size: 18px;
      font-weight: bold;
      direction: ltr;
    }
  </style>
</head>
<body>
  <div class="bg"></div>
  ${hasOverlay ? '<div class="overlay"></div>' : ""}
  <div class="text">${textHtml}</div>
  ${logoDataUri ? `<img class="logo" src="${logoDataUri}" alt="" />` : ""}
  <div class="progress-track"><div class="progress-fill"></div></div>
  <div class="counter">${slideIndex + 1} / ${totalSlides}</div>
</body>
</html>`;

    const image = await nodeHtmlToImage({
        html,
        type: "png",
        encoding: "binary",
        waitUntil: "networkidle0",
        puppeteerArgs: { args: ["--no-sandbox", "--disable-setuid-sandbox"] },
    });

    return Buffer.isBuffer(image) ? image : Buffer.from(image as ArrayBuffer);
}

export async function getTemplateDataUri(templateFile: string): Promise<string> {
    const templatePath = path.join(process.cwd(), "public/carousel-templates", templateFile);
    const ext = templateFile.endsWith(".jpg") ? "jpeg" : "png";
    const buf = fs.readFileSync(templatePath);
    return `data:image/${ext};base64,${buf.toString("base64")}`;
}
