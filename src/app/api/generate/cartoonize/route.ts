export const runtime = "nodejs";
export const maxDuration = 120;

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const VISION_PROMPT = `Analyze this photograph in detail. Extract the following information:
1. Subject description: Describe the person's appearance (face, hair, clothing, body type, pose)
2. Facial features: Identify the most distinctive facial features (eyes, nose, mouth, eyebrows, face shape)
3. Expression: Describe the person's expression and mood
4. Setting/environment: Describe the background and surroundings
5. Hobby/profession clues: Identify any props, clothing, or context that suggests their interests or profession
6. Key props: List any notable objects or accessories visible

Be very specific and detailed. This information will be used to create a professional caricature.`;

const CARTOONIZE_PROMPT_TEMPLATE = `A professional digital caricature of [SUBJECT DESCRIPTION]. The art style should feature a highly expressive, oversized head on a smaller, dynamic body. Focus on exaggerating [SPECIFIC FACIAL FEATURE] and [SPECIFIC EXPRESSION]. The subject should be placed in a [SETTING/ENVIRONMENT] that reflects their passion for [HOBBY/PROFESSION]. Include key props like [PROP 1] and [PROP 2]. The aesthetic should be [ART STYLE: e.g., 3D Pixar-inspired / Hand-drawn ink and watercolor / Sharp vector art], with vibrant colors, cinematic lighting, and a clean, high-contrast background.

Technical requirements:
- High quality, professional digital art
- Exaggerated caricature proportions (large head, smaller body)
- Vibrant, saturated colors
- Clean, high-contrast background
- No text, watermarks, or additional elements
- Preserve the subject's recognizable identity while stylizing`;

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

        // Step 2: Extract key information from description and build caricature prompt
        const extractInfo = (description: string) => {
            const lines = description.split('\n').map(l => l.trim()).filter(l => l);
            
            // Extract subject description (usually first section)
            const subjectMatch = description.match(/subject description[:\-]?\s*(.+?)(?=\n|$)/i) 
                || description.match(/1[.\-]\s*subject[:\-]?\s*(.+?)(?=\n|$)/i);
            const subjectDescription = subjectMatch?.[1]?.trim() || description.split('\n')[0] || "the person in the image";
            
            // Extract facial features
            const facialMatch = description.match(/facial features[:\-]?\s*(.+?)(?=\n|$)/i)
                || description.match(/2[.\-]\s*facial[:\-]?\s*(.+?)(?=\n|$)/i);
            const facialFeature = facialMatch?.[1]?.trim() || "distinctive eyes and facial structure";
            
            // Extract expression
            const expressionMatch = description.match(/expression[:\-]?\s*(.+?)(?=\n|$)/i)
                || description.match(/3[.\-]\s*expression[:\-]?\s*(.+?)(?=\n|$)/i);
            const expression = expressionMatch?.[1]?.trim() || "their natural expression";
            
            // Extract setting
            const settingMatch = description.match(/setting[:\-]?\s*(.+?)(?=\n|$)/i)
                || description.match(/4[.\-]\s*setting[:\-]?\s*(.+?)(?=\n|$)/i);
            const setting = settingMatch?.[1]?.trim() || "a clean, modern environment";
            
            // Extract hobby/profession
            const hobbyMatch = description.match(/hobby[:\-]?\s*(.+?)(?=\n|$)/i)
                || description.match(/5[.\-]\s*hobby[:\-]?\s*(.+?)(?=\n|$)/i);
            const hobby = hobbyMatch?.[1]?.trim() || "their interests";
            
            // Extract props
            const propsMatch = description.match(/props[:\-]?\s*(.+?)(?=\n|$)/i)
                || description.match(/6[.\-]\s*key props[:\-]?\s*(.+?)(?=\n|$)/i);
            const props = propsMatch?.[1]?.trim() || "";
            const propList = props.split(',').map(p => p.trim()).filter(p => p);
            const prop1 = propList[0] || "their accessories";
            const prop2 = propList[1] || "their personal items";
            
            return {
                subjectDescription,
                facialFeature,
                expression,
                setting,
                hobby,
                prop1,
                prop2,
            };
        };

        const info = extractInfo(imageDescription);
        
        // Build the caricature prompt using the template
        const caricaturePrompt = CARTOONIZE_PROMPT_TEMPLATE
            .replace('[SUBJECT DESCRIPTION]', info.subjectDescription)
            .replace('[SPECIFIC FACIAL FEATURE]', info.facialFeature)
            .replace('[SPECIFIC EXPRESSION]', info.expression)
            .replace('[SETTING/ENVIRONMENT]', info.setting)
            .replace('[HOBBY/PROFESSION]', info.hobby)
            .replace('[PROP 1]', info.prop1)
            .replace('[PROP 2]', info.prop2)
            .replace('[ART STYLE: e.g., 3D Pixar-inspired / Hand-drawn ink and watercolor / Sharp vector art]', '3D Pixar-inspired');

        console.log("Caricature prompt:", caricaturePrompt);

        // Step 3: Generate cartoon image from refined prompt
        const imageModel = genAI.getGenerativeModel({
            model: "gemini-3-pro-image-preview",
            generationConfig: {
                responseModalities: ["IMAGE"],
            } as any,
        });

        const imageResult = await imageModel.generateContent(caricaturePrompt);

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
