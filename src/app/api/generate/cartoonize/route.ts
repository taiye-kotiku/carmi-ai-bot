export const runtime = "nodejs";
export const maxDuration = 120;

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import sharp from "sharp";
import { nanoid } from "nanoid";
import { deductCredits, addCredits } from "@/lib/services/credits";
import { CREDIT_COSTS } from "@/lib/config/credits";
import { updateUserStorage } from "@/lib/services/storage";

const VISION_PROMPT = `Analyze this photograph in EXTREME detail. Extract the following information with precise accuracy:
1. Subject description: Describe the person's appearance in detail - face shape, hair color/style/texture, eye color, skin tone, clothing colors and style, body type, pose, age range
2. Facial features: Identify EVERY distinctive facial feature - exact eye shape and color, nose shape and size, mouth shape, lip thickness, eyebrow shape and thickness, cheekbones, jawline, face shape (round/oval/square/heart), any unique features like dimples, freckles, facial hair
3. Expression: Describe the person's exact expression - smile type, eye expression, overall mood
4. Setting/environment: Describe the background and surroundings
5. Hobby/profession clues: Identify any props, clothing, or context that suggests their interests or profession
6. Key props: List any notable objects or accessories visible

CRITICAL: Be extremely specific about facial features, proportions, and unique characteristics. This will be used to create a caricature that MUST look like the same person.`;

const CARTOONIZE_PROMPT_TEMPLATE = `A professional digital caricature of [SUBJECT DESCRIPTION]. 

CRITICAL IDENTITY PRESERVATION REQUIREMENTS:
- The caricature MUST look like the exact same person from the reference photo
- Preserve ALL distinctive facial features: [SPECIFIC FACIAL FEATURE]
- Maintain the exact same expression: [SPECIFIC EXPRESSION]
- Keep the same hair color, style, and texture
- Preserve eye color, shape, and spacing
- Maintain facial proportions and unique characteristics
- The person MUST be instantly recognizable as the same individual

Art style: Highly expressive, oversized head on a smaller, dynamic body. Focus on exaggerating [SPECIFIC FACIAL FEATURE] while maintaining perfect likeness. The subject should be placed in a [SETTING/ENVIRONMENT] that reflects their passion for [HOBBY/PROFESSION]. Include key props like [PROP 1] and [PROP 2]. The aesthetic should be 3D Pixar-inspired, with vibrant colors, cinematic lighting, and a clean, high-contrast background.

Technical requirements:
- Square format, 1080x1080 pixels
- High quality, professional digital art
- Exaggerated caricature proportions (large head, smaller body) BUT maintain facial identity
- Vibrant, saturated colors
- Clean, high-contrast background
- No text, watermarks, or additional elements
- The result MUST be recognizable as the same person from the original photo`;

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
        const userSubjectDescription = formData.get("subject_description") as string | null;
        const userSettingEnvironment = formData.get("setting_environment") as string | null;
        const userHobbyProfession = formData.get("hobby_profession") as string | null;

        if (!file || !file.type.startsWith("image/")) {
            return NextResponse.json(
                { error: "נא להעלות קובץ תמונה (PNG, JPG, WebP)" },
                { status: 400 }
            );
        }

        // Deduct credits upfront (atomic check + deduction)
        try {
            await deductCredits(user.id, "caricature_generation");
        } catch (err) {
            return NextResponse.json(
                {
                    error: (err as Error).message,
                    code: "INSUFFICIENT_CREDITS",
                },
                { status: 402 }
            );
        }

        const buffer = await file.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        const mimeType = file.type || "image/png";

        const genAI = new GoogleGenerativeAI(apiKey);

        // Step 1: Use Gemini Vision to analyze the image
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
            const subjectMatch = description.match(/subject description[:\-]?\s*(.+?)(?=\n|$)/i)
                || description.match(/1[.\-]\s*subject[:\-]?\s*(.+?)(?=\n|$)/i);
            const subjectDescription = subjectMatch?.[1]?.trim() || description.split('\n')[0] || "the person in the image";

            const facialMatch = description.match(/facial features[:\-]?\s*(.+?)(?=\n|$)/i)
                || description.match(/2[.\-]\s*facial[:\-]?\s*(.+?)(?=\n|$)/i);
            const facialFeature = facialMatch?.[1]?.trim() || "distinctive eyes and facial structure";

            const expressionMatch = description.match(/expression[:\-]?\s*(.+?)(?=\n|$)/i)
                || description.match(/3[.\-]\s*expression[:\-]?\s*(.+?)(?=\n|$)/i);
            const expression = expressionMatch?.[1]?.trim() || "their natural expression";

            const settingMatch = description.match(/setting[:\-]?\s*(.+?)(?=\n|$)/i)
                || description.match(/4[.\-]\s*setting[:\-]?\s*(.+?)(?=\n|$)/i);
            const setting = settingMatch?.[1]?.trim() || "a clean, modern environment";

            const hobbyMatch = description.match(/hobby[:\-]?\s*(.+?)(?=\n|$)/i)
                || description.match(/5[.\-]\s*hobby[:\-]?\s*(.+?)(?=\n|$)/i);
            const hobby = hobbyMatch?.[1]?.trim() || "their interests";

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

        const finalSubjectDescription = userSubjectDescription?.trim() || info.subjectDescription;
        const finalSettingEnvironment = userSettingEnvironment?.trim() || info.setting;
        const finalHobbyProfession = userHobbyProfession?.trim() || info.hobby;

        const caricaturePrompt = CARTOONIZE_PROMPT_TEMPLATE
            .replace('[SUBJECT DESCRIPTION]', finalSubjectDescription)
            .replace('[SPECIFIC FACIAL FEATURE]', info.facialFeature)
            .replace('[SPECIFIC EXPRESSION]', info.expression)
            .replace('[SETTING/ENVIRONMENT]', finalSettingEnvironment)
            .replace('[HOBBY/PROFESSION]', finalHobbyProfession)
            .replace('[PROP 1]', info.prop1)
            .replace('[PROP 2]', info.prop2)
            .replace('[ART STYLE: e.g., 3D Pixar-inspired / Hand-drawn ink and watercolor / Sharp vector art]', '3D Pixar-inspired');

        console.log("Caricature prompt:", caricaturePrompt);

        // Step 3: Generate cartoon image
        const imageModel = genAI.getGenerativeModel({
            model: "gemini-3-pro-image-preview",
            generationConfig: {
                responseModalities: ["IMAGE"],
            } as any,
        });

        const imageResult = await imageModel.generateContent([
            {
                inlineData: {
                    data: base64,
                    mimeType,
                },
            },
            caricaturePrompt,
        ]);

        const response = imageResult.response;
        const imagePart = response.candidates?.[0]?.content?.parts?.find(
            (p: any) => p.inlineData?.mimeType?.startsWith("image/")
        );

        if (!imagePart?.inlineData) {
            console.error("No image in response:", JSON.stringify(response, null, 2));

            await addCredits(
                user.id,
                CREDIT_COSTS.caricature_generation,
                "החזר - יצירת קריקטורה נכשלה"
            );

            return NextResponse.json(
                { error: "לא נוצרה תמונת קריקטורה. נסה תמונה אחרת." },
                { status: 500 }
            );
        }

        // Step 4: Resize image to exactly 1080x1080 pixels
        const generatedImageBuffer = Buffer.from(imagePart.inlineData.data, "base64");
        const resizedImageBuffer = await sharp(generatedImageBuffer)
            .resize(1080, 1080, {
                fit: "cover",
                position: "center",
            })
            .png({ quality: 100 })
            .toBuffer();

        const totalFileSize = resizedImageBuffer.length;

        // Upload to Supabase Storage instead of returning base64
        const jobId = nanoid();
        const fileName = `${user.id}/${jobId}/caricature.png`;

        const { error: uploadError } = await supabaseAdmin.storage
            .from("content")
            .upload(fileName, resizedImageBuffer, {
                contentType: "image/png",
                upsert: true,
            });

        let resultUrl: string;

        if (uploadError) {
            console.warn("Upload to storage failed, returning base64:", uploadError);
            const resizedBase64 = resizedImageBuffer.toString("base64");
            resultUrl = `data:image/png;base64,${resizedBase64}`;
        } else {
            const { data: urlData } = supabaseAdmin.storage
                .from("content")
                .getPublicUrl(fileName);
            resultUrl = urlData.publicUrl;
        }

        // Save generation record
        const generationId = nanoid();
        await supabaseAdmin.from("generations").insert({
            id: generationId,
            user_id: user.id,
            type: "image",
            feature: "cartoonize",
            prompt: caricaturePrompt.substring(0, 500),
            result_urls: [resultUrl],
            thumbnail_url: resultUrl,
            status: "completed",
            completed_at: new Date().toISOString(),
            file_size_bytes: totalFileSize,
            files_deleted: false,
        });

        // Update user storage (only if uploaded to storage, not base64)
        if (!uploadError) {
            await updateUserStorage(user.id, totalFileSize);
        }

        return NextResponse.json({
            success: true,
            imageUrl: resultUrl,
        });
    } catch (error: any) {
        console.error("Cartoonize error:", error);

        try {
            const supabase = await createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await addCredits(
                    user.id,
                    CREDIT_COSTS.caricature_generation,
                    "החזר - יצירת קריקטורה נכשלה"
                );
            }
        } catch (refundError) {
            console.error("Refund failed:", refundError);
        }

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