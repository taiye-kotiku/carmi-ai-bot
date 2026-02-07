// src/app/api/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await request.formData();
        const fileEntry = formData.get("file");

        if (!fileEntry || !(fileEntry instanceof File)) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }
        const file = fileEntry;

        // Validate file
        if (!file.type.startsWith("image/")) {
            return NextResponse.json(
                { error: "Only image files are allowed" },
                { status: 400 }
            );
        }

        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json(
                { error: "File too large. Max 10MB." },
                { status: 400 }
            );
        }

        // Generate unique filename
        const ext = file.name.split(".").pop() || "png";
        const fileName = `${user.id}/${crypto.randomUUID()}.${ext}`;

        const bucket = (formData.get("bucket") as string) || "character-images";
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { data, error: uploadError } = await supabaseAdmin.storage
            .from(bucket)
            .upload(fileName, buffer, {
                contentType: file.type,
                upsert: false,
            });

        if (uploadError) {
            console.error("[Upload] Error:", uploadError);
            return NextResponse.json(
                { error: uploadError.message },
                { status: 500 }
            );
        }

        // Get public URL
        const {
            data: { publicUrl },
        } = supabaseAdmin.storage.from(bucket).getPublicUrl(data.path);

        return NextResponse.json({
            url: publicUrl,
            path: data.path,
        });
    } catch (error) {
        console.error("[Upload] Unexpected error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}