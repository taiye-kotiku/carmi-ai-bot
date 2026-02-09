// src/app/api/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await request.formData();

        // Handle both 'file' (single) and 'files' (multiple)
        const singleFile = formData.get("file") as File | null;
        const multipleFiles = formData.getAll("files") as File[];

        // Combine all files
        const allFiles: File[] = [];
        if (singleFile && singleFile.size > 0) {
            allFiles.push(singleFile);
        }
        if (multipleFiles.length > 0) {
            allFiles.push(...multipleFiles.filter(f => f.size > 0));
        }

        if (allFiles.length === 0) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        console.log(`[Upload] Uploading ${allFiles.length} files`);

        const uploadedUrls: string[] = [];
        const bucket = (formData.get("bucket") as string) || "images";

        for (const file of allFiles) {
            try {
                const fileExt = file.name.split(".").pop() || "jpg";
                const fileName = `${user.id}/${crypto.randomUUID()}.${fileExt}`;

                const arrayBuffer = await file.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);

                const { error: uploadError } = await supabaseAdmin.storage
                    .from(bucket)
                    .upload(fileName, buffer, {
                        contentType: file.type,
                        upsert: true,
                    });

                if (uploadError) {
                    console.error(`[Upload] Failed ${file.name}:`, uploadError);

                    // Try creating bucket if it doesn't exist
                    if (uploadError.message?.includes("not found")) {
                        await supabaseAdmin.storage.createBucket(bucket, {
                            public: true,
                        });

                        // Retry upload
                        const { error: retryError } = await supabaseAdmin.storage
                            .from(bucket)
                            .upload(fileName, buffer, {
                                contentType: file.type,
                                upsert: true,
                            });

                        if (retryError) {
                            console.error(`[Upload] Retry failed:`, retryError);
                            continue;
                        }
                    } else {
                        continue;
                    }
                }

                const { data: { publicUrl } } = supabaseAdmin.storage
                    .from(bucket)
                    .getPublicUrl(fileName);

                uploadedUrls.push(publicUrl);
                console.log(`[Upload] Success: ${file.name} -> ${publicUrl}`);

            } catch (err) {
                console.error(`[Upload] Error with ${file.name}:`, err);
            }
        }

        if (uploadedUrls.length === 0) {
            return NextResponse.json({ error: "All uploads failed" }, { status: 500 });
        }

        // Return both formats for compatibility
        return NextResponse.json({
            success: true,
            url: uploadedUrls[0], // For single file requests
            urls: uploadedUrls,   // For multiple file requests
            count: uploadedUrls.length,
        });

    } catch (error: any) {
        console.error("[Upload] Error:", error);
        return NextResponse.json(
            { error: error.message || "Upload failed" },
            { status: 500 }
        );
    }
}