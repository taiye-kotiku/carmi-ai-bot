export const runtime = "nodejs";
export const maxDuration = 120;

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const VISION_PROMPT = `Analyze this photograph in detail. Describe:
- The person's appearance (face, hair, clothing, pose)
- The setting/background
- Lighting and mood
- Key visual elements

Be very specific about facial features, expression, and pose. This description will be used to recreate the image in cartoon style.`;

const CARTOONIZE_PROMPT = `Create a high-quality cartoon/illustration version of this person. 
Style: Clean lines, flat or semi-flat colors, stylized cartoon aesthetic (anime, digital art, or classic cartoon).
Preserve the exact identity, facial features, pose, and composition from the description.
Maintain the same framing and background elements.
Do NOT add text, watermarks, or alter the subject's appearance beyond style transformation.
High quality, professional cartoon illustration.`;

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

        const genAI = new GoogleGenerativeAI(apiKey);

        // Step 1: Use Gemini Vision to analyze the image (gemini-2.5-flash supports vision)
        const visionModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const visionResult = await visionModel.generateContent([
            {
                inlineData: {
                    data: base64,
                    mimeType,
                },
            },
            VISION_PROMPT,
        ]);

        const imageDescription = visionResult.response.text();
        console.log("Image description:", imageDescription);

        // Step 2: Generate cartoon image from description (use Nano Banana Pro)
        const imageModel = genAI.getGenerativeModel({
            model: "gemini-3-pro-image-preview", // Nano Banana Pro
            generationConfig: {
                responseModalities: ["IMAGE"],
            } as any,
        });

        const fullPrompt = `${CARTOONIZE_PROMPT}\n\nBased on this description: ${imageDescription}`;
        const imageResult = await imageModel.generateContent(fullPrompt);

        const response = imageResult.response;
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
