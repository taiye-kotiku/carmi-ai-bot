// Suggests carousel template based on content using Gemini
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { CAROUSEL_TEMPLATES } from "@/lib/carousel/templates";

const TEMPLATE_LIST = Object.values(CAROUSEL_TEMPLATES)
    .map((t) => `${t.id}: ${t.style} (${t.category})`)
    .join("\n");

export async function POST(req: Request) {
    try {
        const apiKey = process.env.GOOGLE_AI_API_KEY?.trim();
        if (!apiKey) {
            return NextResponse.json({ template_id: "b1", error: "GOOGLE_AI_API_KEY חסר – נבחרה תבנית ברירת מחדל" });
        }

        const { topic, content } = await req.json();
        const description = topic || content || "";

        if (!description.trim()) {
            return NextResponse.json({ error: "נא להזין תיאור" }, { status: 400 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

        const prompt = `אתה עוזר בבחירת תבנית לקרוסלה. להלן רשימת תבניות זמינות:

${TEMPLATE_LIST}

המשתמש מתאר: "${description}"

בחר את התבנית המתאימה ביותר (מזהה אחד בלבד). החזר רק את המזהה, בלי הסברים.
דוגמה: b1`;

        const result = await model.generateContent(prompt);
        let suggestedId = result.response.text().trim().replace(/["']/g, "");

        if (!CAROUSEL_TEMPLATES[suggestedId]) {
            suggestedId = "b1";
        }

        return NextResponse.json({ template_id: suggestedId });
    } catch (error) {
        console.error("Template suggest error:", error);
        return NextResponse.json({ error: "שגיאה בבחירת תבנית", template_id: "b1" }, { status: 500 });
    }
}
