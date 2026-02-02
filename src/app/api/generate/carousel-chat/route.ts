import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { message, slideCount = 5, previousSlides } = body;

        if (!message?.trim()) {
            return NextResponse.json(
                { error: "נא להזין תוכן" },
                { status: 400 }
            );
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

        const systemPrompt = `אתה סוכן תוכן מקצועי ליצירת קרוסלות לרשתות חברתיות.
המשתמש נותן לך תוכן בעברית ואתה מייצר תוכן לשקופיות קרוסלה.
כל שקופית צריכה להיות קצרה (1-2 משפטים, עד 25 מילים).
השתמש ב-* לסמן מילים להדגשה (הן יוצגו בצבע בולט).
השפה חייבת להיות עברית.
השקופית הראשונה - כותרת/הוק מושכת.
השקופית האחרונה - קריאה לפעולה או סיכום.
החזר רק מערך JSON של מחרוזות, בלי הסברים.`;

        const userPrompt = previousSlides?.length
            ? `המשתמש כבר יצר שקופיות: ${JSON.stringify(previousSlides)}
עכשיו הוא מבקש: "${message}"
צור ${slideCount} שקופיות חדשות בהתאם.`
            : `המשתמש מבקש: "${message}"
צור ${slideCount} שקופיות לקרוסלה.`;

        const result = await model.generateContent([
            systemPrompt,
            userPrompt,
            `החזר רק מערך JSON: ["שקופית 1", "שקופית 2", ...]`,
        ]);

        const responseText = result.response.text();
        const cleaned = responseText
            .replace(/```json\n?/g, "")
            .replace(/```\n?/g, "")
            .trim();

        const slides = JSON.parse(cleaned);
        if (!Array.isArray(slides)) {
            throw new Error("Invalid response format");
        }

        return NextResponse.json({ slides: slides.slice(0, slideCount) });
    } catch (error) {
        console.error("Carousel chat error:", error);
        return NextResponse.json(
            { error: "שגיאה ביצירת התוכן. נסה שוב." },
            { status: 500 }
        );
    }
}
