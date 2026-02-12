import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

export async function DELETE() {
    try {
        const supabase = await createClient();
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json(
                { error: "לא מחובר. אנא התחבר ונסה שוב." },
                { status: 401 }
            );
        }

        const userId = user.id;

        const supabaseAdmin = createSupabaseAdmin(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Delete user data from all tables (order matters for foreign keys)
        const deletionSteps: { table: string; column: string }[] = [
            { table: "notifications", column: "user_id" },
            { table: "credit_transactions", column: "user_id" },
            { table: "generations", column: "user_id" },
            { table: "jobs", column: "user_id" },
            { table: "characters", column: "user_id" },
            { table: "credits", column: "user_id" },
            { table: "subscriptions", column: "user_id" },
            { table: "user_storage", column: "user_id" },
            { table: "brands", column: "user_id" },
            { table: "profiles", column: "id" },
        ];

        for (const step of deletionSteps) {
            const { error } = await supabaseAdmin
                .from(step.table)
                .delete()
                .eq(step.column, userId);

            if (error && error.code !== "PGRST116") {
                console.error(`Error deleting from ${step.table}:`, error.message);
            }
        }

        // Delete storage files
        const storageBuckets = [
            "avatars",
            "uploads",
            "generations",
            "logos",
            "characters",
        ];

        for (const bucket of storageBuckets) {
            try {
                const { data: files } = await supabaseAdmin.storage
                    .from(bucket)
                    .list(userId);

                if (files && files.length > 0) {
                    const filePaths = files.map((file) => `${userId}/${file.name}`);
                    await supabaseAdmin.storage.from(bucket).remove(filePaths);
                }
            } catch {
                console.log(`Storage bucket "${bucket}" cleanup skipped`);
            }
        }

        // Delete auth user
        const { error: deleteAuthError } =
            await supabaseAdmin.auth.admin.deleteUser(userId);

        if (deleteAuthError) {
            console.error("Error deleting auth user:", deleteAuthError);
            return NextResponse.json(
                { error: "שגיאה במחיקת החשבון. אנא פנה לתמיכה." },
                { status: 500 }
            );
        }

        return NextResponse.json({ message: "החשבון נמחק בהצלחה" }, { status: 200 });
    } catch (error: any) {
        console.error("Delete account error:", error);
        return NextResponse.json(
            { error: "שגיאה פנימית. אנא נסה שוב מאוחר יותר." },
            { status: 500 }
        );
    }
}