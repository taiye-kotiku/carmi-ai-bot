// Test route - bypasses auth for carousel content generation
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { message, slideCount = 5, previousSlides } = body;

        if (!message?.trim()) {
            return NextResponse.json({ error: "נא להזין תוכן" }, { status: 400 });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

        const systemPrompt = `אתה סוכן תוכן מקצועי ליצירת קרוסלות. המשתמש נותן תוכן בעברית ואתה מייצר תוכן לשקופיות.
כל שקופית קצרה (1-2 משפטים, עד 25 מילים). סמן מילים להדגשה עם *כוכביות* - הן יוצגו במודגש ובצהוב.
השפה עברית. החזר רק מערך JSON של מחרוזות.`;

        const userPrompt = previousSlides?.length
            ? `שקופיות קיימות: ${JSON.stringify(previousSlides)}\nבקשה: "${message}"\nצור ${slideCount} שקופיות.`
            : `בקשה: "${message}"\nצור ${slideCount} שקופיות.`;

        const result = await model.generateContent([systemPrompt, userPrompt, 'החזר רק JSON: ["שקופית 1", "שקופית 2", ...]']);
        const responseText = result.response.text();
        const cleaned = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const slides = JSON.parse(cleaned);

        return NextResponse.json({ slides: Array.isArray(slides) ? slides.slice(0, slideCount) : [] });
    } catch (error) {
        console.error("Carousel chat test error:", error);
        return NextResponse.json({ error: "שגיאה ביצירת תוכן" }, { status: 500 });
    }
}
