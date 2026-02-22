export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { decreaseUserStorage } from "@/lib/services/storage";

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: gen, error: fetchError } = await supabaseAdmin
            .from("generations")
            .select("id, user_id, result_urls, file_size_bytes, files_deleted")
            .eq("id", id)
            .eq("user_id", user.id)
            .single();

        if (fetchError || !gen) {
            return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
        }

        if (gen.files_deleted) {
            return NextResponse.json({ error: "כבר נמחק" }, { status: 400 });
        }

        // Mark as deleted (soft delete)
        await supabaseAdmin
            .from("generations")
            .update({ files_deleted: true })
            .eq("id", id)
            .eq("user_id", user.id);

        const freedBytes = gen.file_size_bytes || 0;
        if (freedBytes > 0) {
            await decreaseUserStorage(user.id, freedBytes);
        }

        return NextResponse.json({ success: true, freedBytes });
    } catch (error: any) {
        console.error("[DeleteGeneration] Error:", error);
        return NextResponse.json(
            { error: error.message || "שגיאה במחיקה" },
            { status: 500 }
        );
    }
}
