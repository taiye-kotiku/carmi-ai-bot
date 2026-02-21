// src/lib/services/hebrew-caption.ts
// Overlay Hebrew text on images (for story frames)

import { createCanvas, loadImage } from "@napi-rs/canvas";

export async function addHebrewCaption(
    imageUrl: string,
    text: string,
    options?: { fontSize?: number }
): Promise<Buffer> {
    const fontSize = options?.fontSize ?? 48;

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`);
    const imgBuf = Buffer.from(await imgRes.arrayBuffer());
    const img = await loadImage(imgBuf);

    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");

    ctx.drawImage(img, 0, 0);

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    const padding = 24;
    const textY = img.height - padding - fontSize;
    ctx.fillRect(0, textY - fontSize, img.width, fontSize + padding * 2);

    ctx.fillStyle = "white";
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Single line or simple split for Hebrew
    const maxLen = 40;
    const truncated = text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
    ctx.fillText(truncated, img.width / 2, textY + fontSize / 2);

    return canvas.toBuffer("image/png");
}
