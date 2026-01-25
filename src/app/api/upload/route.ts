// src/app/api/upload/route.ts
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
        const files = formData.getAll("files") as File[];

        if (!files.length) {
            return NextResponse.json(
                { error: "נא להעלות קבצים" },
                { status: 400 }
            );
        }

        const urls: string[] = [];

        for (const file of files) {
            // Validate file type
            if (!file.type.startsWith("image/")) {
                continue;
            }

            // Max 10MB
            if (file.size > 10 * 1024 * 1024) {
                continue;
            }

            const buffer = Buffer.from(await file.arrayBuffer());
            const ext = file.name.split(".").pop() || "png";
            const fileName = `${user.id}/characters/${nanoid()}.${ext}`;

            const { error } = await supabaseAdmin.storage
                .from("content")
                .upload(fileName, buffer, {
                    contentType: file.type,
                    upsert: true,
                });

            if (!error) {
                const { data } = supabaseAdmin.storage
                    .from("content")
                    .getPublicUrl(fileName);
                urls.push(data.publicUrl);
            }
        }

        return NextResponse.json({ urls });
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({ error: "שגיאה בהעלאה" }, { status: 500 });
    }
}