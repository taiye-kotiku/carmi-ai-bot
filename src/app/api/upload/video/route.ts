import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const formData = await req.formData();
        const file = formData.get("video") as File;

        if (!file) {
            return NextResponse.json(
                { error: "נא להעלות קובץ וידאו" },
                { status: 400 }
            );
        }

        // Validate file size (100MB max)
        if (file.size > 100 * 1024 * 1024) {
            return NextResponse.json(
                { error: "גודל הקובץ חייב להיות עד 100MB" },
                { status: 400 }
            );
        }

        // Upload to Supabase Storage
        const fileExt = file.name.split(".").pop();
        const fileName = `${nanoid()}.${fileExt}`;
        const filePath = `uploads/${user.id}/${fileName}`;

        const arrayBuffer = await file.arrayBuffer();
        const { data, error: uploadError } = await supabase.storage
            .from("content")
            .upload(filePath, arrayBuffer, {
                contentType: file.type,
                upsert: false,
            });

        if (uploadError) {
            console.error("Upload error:", uploadError);
            return NextResponse.json(
                { error: "שגיאה בהעלאת הקובץ: " + uploadError.message },
                { status: 500 }
            );
        }

        // Get public URL
        const {
            data: { publicUrl },
        } = supabase.storage.from("content").getPublicUrl(filePath);

        return NextResponse.json({
            url: publicUrl,
            path: filePath,
        });
    } catch (error) {
        console.error("Video upload error:", error);
        return NextResponse.json(
            { error: "שגיאה בשרת" },
            { status: 500 }
        );
    }
}
