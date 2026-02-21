// src/lib/services/url-extractor.ts

import { load } from "cheerio";

export interface ExtractedContent {
    title: string;
    description: string;
    text: string;
    images: string[];
}

/**
 * Extract main text and images from a website URL.
 * Used by Creative Hub when user provides a website URL.
 */
export async function extractUrlContent(url: string): Promise<ExtractedContent> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; CarmiBot/1.0; +https://carmi.ai)",
            },
        });
        clearTimeout(timeout);

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const html = await res.text();
        const $ = load(html);

        // Remove script, style, nav, footer
        $("script, style, nav, footer, header, aside, [role='navigation']").remove();

        const title =
            $("meta[property='og:title']").attr("content") ||
            $("title").text().trim() ||
            "";

        const description =
            $("meta[property='og:description']").attr("content") ||
            $("meta[name='description']").attr("content") ||
            "";

        // Prefer article/main content
        const contentSelectors = [
            "article",
            "main",
            "[role='main']",
            ".content",
            ".article",
            ".post",
            "#content",
        ];
        let bodyEl = $(contentSelectors.join(", ")).first();
        if (!bodyEl.length) {
            bodyEl = $("body");
        }

        const text = bodyEl
            .text()
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 8000);

        // Extract images - og:image first, then content images
        const images: string[] = [];
        const ogImage = $("meta[property='og:image']").attr("content");
        if (ogImage) {
            images.push(resolveUrl(ogImage, url));
        }

        $("img[src]").each((_, el) => {
            const src = $(el).attr("src");
            if (src && !src.startsWith("data:") && images.length < 5) {
                const resolved = resolveUrl(src, url);
                if (!images.includes(resolved)) {
                    images.push(resolved);
                }
            }
        });

        return {
            title,
            description,
            text: [title, description, text].filter(Boolean).join("\n\n"),
            images: images.slice(0, 5),
        };
    } catch (err) {
        console.error("[url-extractor] Error:", err);
        throw new Error("לא ניתן לחלץ תוכן מהקישור");
    }
}

function resolveUrl(href: string, base: string): string {
    if (href.startsWith("http")) return href;
    try {
        return new URL(href, base).href;
    } catch {
        return href;
    }
}
