import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get("logo") as File;

        if (!file || !file.type.startsWith("image/")) {
            return NextResponse.json(
                { error: "נא להעלות קובץ תמונה (PNG, JPG)" },
                { status: 400 }
            );
        }

        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json(
                { error: "גודל הקובץ מקסימלי 5MB" },
                { status: 400 }
            );
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const ext = file.name.split(".").pop() || "png";
        const fileName = `${user.id}/logos/${nanoid()}.${ext}`;

        const { error } = await supabaseAdmin.storage
            .from("content")
            .upload(fileName, buffer, {
                contentType: file.type,
                upsert: true,
            });

        if (error) {
            console.error("Logo upload error:", error);
            return NextResponse.json({ error: "שגיאה בהעלאת הלוגו" }, { status: 500 });
        }

        const { data } = supabaseAdmin.storage
            .from("content")
            .getPublicUrl(fileName);

        return NextResponse.json({ url: data.publicUrl });
    } catch (error) {
        console.error("Logo upload error:", error);
        return NextResponse.json({ error: "שגיאה בהעלאה" }, { status: 500 });
    }
}
