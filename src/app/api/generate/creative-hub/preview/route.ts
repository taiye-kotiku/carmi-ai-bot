export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { extractUrlContent } from "@/lib/services/url-extractor";

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { prompt, websiteUrl } = body as {
            prompt: string;
            websiteUrl?: string;
        };

        if (!prompt?.trim()) {
            return NextResponse.json(
                { error: "נא להזין תיאור" },
                { status: 400 }
            );
        }

        let finalPrompt = prompt.trim();

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
