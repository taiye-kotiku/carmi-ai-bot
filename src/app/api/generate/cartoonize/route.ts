export const runtime = "nodejs";
export const maxDuration = 60;

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const CARTOONIZE_SYSTEM_PROMPT = `You are an expert at transforming photographs into high-quality cartoon and digital art styles.

Transform the provided photograph into a cartoon/illustration style. You MUST:
- Preserve the subject's identity, face, pose, and key features
- Use clean lines, flat or semi-flat colors, and a stylized cartoon aesthetic
- Maintain the same composition and framing as the original
- Output a single image in cartoon/illustration style (anime, digital art, or classic cartoon - choose what fits best)
- Do NOT add text, watermarks, or alter the subject's appearance beyond style

Return ONLY the transformed cartoon image.`;

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const apiKey = process.env.GOOGLE_AI_API_KEY?.trim();
        if (!apiKey) {
            return NextResponse.json(
                { error: "GOOGLE_AI_API_KEY not configured" },
                { status: 500 }
            );
        }

        const formData = await req.formData();
        const file = formData.get("image") as File | null;

        if (!file || !file.type.startsWith("image/")) {
            return NextResponse.json(
                { error: "נא להעלות קובץ תמונה (PNG, JPG, WebP)" },
                { status: 400 }
            );
        }

        const buffer = await file.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        const mimeType = file.type || "image/png";

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    inlineData: {
                                        mimeType,
                                        data: base64,
                                    },
                                },
                                {
                                    text: CARTOONIZE_SYSTEM_PROMPT,
                                },
                            ],
                        },
                    ],
                    generationConfig: {
                        responseModalities: ["Text", "Image"],
                        responseMimeType: "image/png",
                    },
                }),
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            console.error("Gemini cartoonize error:", errText);
            return NextResponse.json(
                { error: "שגיאה ביצירת הקריקטורה" },
                { status: 500 }
            );
        }

        const data = await response.json();
        const imagePart = data.candidates?.[0]?.content?.parts?.find(
            (p: any) => p.inlineData?.mimeType?.startsWith("image/")
        );

        if (!imagePart?.inlineData) {
            return NextResponse.json(
                { error: "לא נוצרה תמונת קריקטורה" },
                { status: 500 }
            );
        }

        const resultDataUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;

        return NextResponse.json({
            success: true,
            imageUrl: resultDataUrl,
        });
    } catch (error: any) {
        console.error("Cartoonize error:", error);
        return NextResponse.json(
            { error: error.message || "שגיאה בהמרה לקריקטורה" },
            { status: 500 }
        );
    }
}
