export const runtime = "nodejs";
export const maxDuration = 60;

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const CARTOONIZE_PROMPT = `Transform this photograph into a high-quality cartoon/illustration style. 
Preserve the subject's identity, face, pose, and key features.
Use clean lines, flat or semi-flat colors, and a stylized cartoon aesthetic (anime, digital art, or classic cartoon style).
Maintain the same composition and framing as the original.
Do NOT add text, watermarks, or alter the subject's appearance beyond style transformation.`;

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

        // Use Google Generative AI SDK
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-exp-image-generation",
            generationConfig: {
                responseModalities: ["IMAGE"],
                responseMimeType: "image/png",
            } as any,
        });

        const result = await model.generateContent([
            {
                inlineData: {
                    data: base64,
                    mimeType,
                },
            },
            CARTOONIZE_PROMPT,
        ]);

        const response = result.response;
        const imagePart = response.candidates?.[0]?.content?.parts?.find(
            (p: any) => p.inlineData?.mimeType?.startsWith("image/")
        );

        if (!imagePart?.inlineData) {
            console.error("No image in response:", JSON.stringify(response, null, 2));
            return NextResponse.json(
                { error: "לא נוצרה תמונת קריקטורה. נסה תמונה אחרת." },
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
        const errorMessage = error.message || "שגיאה בהמרה לקריקטורה";
        
        // Provide more helpful error messages
        if (errorMessage.includes("API key")) {
            return NextResponse.json(
                { error: "שגיאת הגדרה: GOOGLE_AI_API_KEY לא מוגדר" },
                { status: 500 }
            );
        }
        
        if (errorMessage.includes("quota") || errorMessage.includes("rate limit")) {
            return NextResponse.json(
                { error: "מגבלת שימוש - נסה שוב בעוד כמה דקות" },
                { status: 429 }
            );
        }

        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
