export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { extractUrlContent } from "@/lib/services/url-extractor";

const apiKey = process.env.GOOGLE_AI_API_KEY;

async function describeImage(imageBase64: string, mimeType: string): Promise<string | null> {
    if (!apiKey) return null;
    try {
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            systemInstruction: `You are a concise image describer. Describe the image in Hebrew: the person (if any) - appearance, clothing, pose; the scene, objects, text visible. Keep it under 150 words. Return ONLY the description, no preamble.`,
        });
        const result = await model.generateContent([
            { inlineData: { data: imageBase64, mimeType } },
            { text: "תאר את התמונה בעברית בקצרה: הדמות (אם יש), הרקע, האובייקטים, טקסט גלוי." },
        ]);
        const text = result.response.text()?.trim();
        return text && text.length > 10 ? text : null;
    } catch (err) {
        console.warn("[CreativeHub Preview] Image description failed:", err);
        return null;
    }
}

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { prompt, websiteUrl, imageBase64, imageMimeType } = body as {
            prompt: string;
            websiteUrl?: string;
            imageBase64?: string;
            imageMimeType?: string;
        };

        if (!prompt?.trim()) {
            return NextResponse.json(
                { error: "נא להזין תיאור" },
                { status: 400 }
            );
        }

        let finalPrompt = prompt.trim();

        // Add content from uploaded image
        if (imageBase64 && imageMimeType) {
            try {
                const imageDesc = await describeImage(imageBase64, imageMimeType || "image/png");
                if (imageDesc) {
                    finalPrompt = `${finalPrompt}\n\nתוכן מהתמונה המצורפת (הדמות/התמונה תשמש כהשראה):\n${imageDesc}`;
                }
            } catch (err) {
                console.warn("[CreativeHub Preview] Image analysis failed:", err);
            }
        }

        // Add content from website URL
        if (websiteUrl?.trim()) {
            try {
                const extracted = await extractUrlContent(websiteUrl.trim());
                if (extracted.text) {
                    finalPrompt = `${finalPrompt}\n\nתוכן מהאתר:\n${extracted.text.slice(0, 3000)}`;
                }
            } catch (err) {
                console.warn("[CreativeHub Preview] URL extraction failed:", err);
            }
        }

        return NextResponse.json({ finalPrompt });
    } catch (error: any) {
        console.error("[CreativeHub Preview] Error:", error);
        return NextResponse.json(
            { error: error.message || "שגיאה בשרת" },
            { status: 500 }
        );
    }
}
