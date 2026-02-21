export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { slides, templateId, customBackgroundBase64 } = await req.json();

        if (!slides?.length || !customBackgroundBase64) {
            return NextResponse.json({ error: "Missing slides or background" }, { status: 400 });
        }

        const { generateCarousel } = await import("@/lib/services/carousel");
        const result = await generateCarousel({
            slides,
            templateId: "custom",
            customBackgroundBase64,
        });

        const uploadedUrls: string[] = [];
        for (let i = 0; i < result.images.length; i++) {
            const buf = result.images[i];
            const fn = `${user.id}/${nanoid()}/carousel_regen_${i + 1}.png`;
            const { error } = await supabaseAdmin.storage
                .from("content")
                .upload(fn, buf, { contentType: "image/png", upsert: true });
            if (!error) {
                const { data } = supabaseAdmin.storage.from("content").getPublicUrl(fn);
                uploadedUrls.push(data.publicUrl);
            }
        }

        return NextResponse.json({ images: uploadedUrls });
    } catch (error: any) {
        console.error("[CarouselRegen] Error:", error);
        return NextResponse.json(
            { error: error.message || "שגיאה ביצירת קרוסלה מחדש" },
            { status: 500 }
        );
    }
}
