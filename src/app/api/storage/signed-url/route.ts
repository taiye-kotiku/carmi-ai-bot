import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

/**
 * Creates a signed upload URL for direct client-to-Supabase uploads.
 * This bypasses both Vercel's 4.5MB body limit and Supabase RLS policies.
 */
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

        const body = await req.json();
        const { fileExt, contentType, bucket = "content" } = body;

        if (!fileExt) {
            return NextResponse.json(
                { error: "fileExt is required" },
                { status: 400 }
            );
        }

        // Generate unique file path
        const fileName = `${nanoid()}.${fileExt}`;
        const filePath = `uploads/${user.id}/${fileName}`;

        // Create signed upload URL using admin client (bypasses RLS)
        const { data, error } = await supabaseAdmin.storage
            .from(bucket)
            .createSignedUploadUrl(filePath);

        if (error) {
            console.error("Signed URL error:", error);

            // If bucket doesn't exist, try creating it
            if (error.message?.includes("not found")) {
                await supabaseAdmin.storage.createBucket(bucket, {
                    public: true,
                });

                const { data: retryData, error: retryError } =
                    await supabaseAdmin.storage
                        .from(bucket)
                        .createSignedUploadUrl(filePath);

                if (retryError) {
                    return NextResponse.json(
                        { error: "שגיאה ביצירת קישור העלאה: " + retryError.message },
                        { status: 500 }
                    );
                }

                const { data: { publicUrl } } = supabaseAdmin.storage
                    .from(bucket)
                    .getPublicUrl(filePath);

                return NextResponse.json({
                    signedUrl: retryData.signedUrl,
                    token: retryData.token,
                    path: filePath,
                    publicUrl,
                });
            }

            return NextResponse.json(
                { error: "שגיאה ביצירת קישור העלאה: " + error.message },
                { status: 500 }
            );
        }

        // Get public URL for the file
        const { data: { publicUrl } } = supabaseAdmin.storage
            .from(bucket)
            .getPublicUrl(filePath);

        return NextResponse.json({
            signedUrl: data.signedUrl,
            token: data.token,
            path: filePath,
            publicUrl,
        });
    } catch (error) {
        console.error("Signed URL error:", error);
        return NextResponse.json(
            { error: "שגיאה בשרת: " + (error instanceof Error ? error.message : "Unknown") },
            { status: 500 }
        );
    }
}
