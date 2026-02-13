import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { CREDIT_COSTS } from "@/lib/config/credits";

const STORAGE_LIMIT_BYTES = 104857600; // 100MB
const WARNING_THRESHOLD_BYTES = 83886080; // 80MB
const AUTO_DELETE_DAYS = 3;

// Base unit cost
const BASE_MB = 50;
const BASE_COST = CREDIT_COSTS.storage_expansion || 15;

// ... GET method remains the same ...
export async function GET() {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const admin = createSupabaseAdmin(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Get or create storage record
        let { data: storage } = await admin
            .from("user_storage")
            .select("*")
            .eq("user_id", user.id)
            .single();

        if (!storage) {
            // Calculate actual usage from generations
            const { data: generations } = await admin
                .from("generations")
                .select("file_size_bytes")
                .eq("user_id", user.id)
                .eq("files_deleted", false);

            const usedBytes = (generations || []).reduce(
                (sum, g) => sum + (g.file_size_bytes || 0),
                0
            );

            const { data: newStorage } = await admin
                .from("user_storage")
                .insert({
                    user_id: user.id,
                    used_bytes: usedBytes,
                    limit_bytes: STORAGE_LIMIT_BYTES,
                })
                .select()
                .single();

            storage = newStorage;
        }

        // Check if we need to send a warning
        const usedBytes = storage?.used_bytes || 0;
        const limitBytes = storage?.limit_bytes || STORAGE_LIMIT_BYTES;
        const isOverWarning = usedBytes >= WARNING_THRESHOLD_BYTES;
        const isOverLimit = usedBytes >= limitBytes;

        // Send warning notification if needed
        if (isOverWarning && !storage?.warning_sent_at) {
            const warningType = isOverLimit ? "storage_critical" : "storage_warning";
            const warningTitle = isOverLimit
                ? "⚠️ האחסון שלך מלא!"
                : "⚠️ האחסון שלך כמעט מלא";
            const warningBody = isOverLimit
                ? `השתמשת ב-${formatBytes(usedBytes)} מתוך ${formatBytes(limitBytes)}. יצירות ישנות יימחקו אוטומטית בעוד ${AUTO_DELETE_DAYS} ימים אלא אם תפנה מקום.`
                : `השתמשת ב-${formatBytes(usedBytes)} מתוך ${formatBytes(limitBytes)}. שקול לרכוש אחסון נוסף.`;

            await admin.from("notifications").insert({
                user_id: user.id,
                type: warningType,
                title: warningTitle,
                body: warningBody,
                metadata: { used_bytes: usedBytes, limit_bytes: limitBytes },
            });

            const autoDeleteAfter = isOverLimit
                ? new Date(Date.now() + AUTO_DELETE_DAYS * 24 * 60 * 60 * 1000).toISOString()
                : null;

            await admin
                .from("user_storage")
                .update({
                    warning_sent_at: new Date().toISOString(),
                    auto_delete_after: autoDeleteAfter,
                    updated_at: new Date().toISOString(),
                })
                .eq("user_id", user.id);
        }

        return NextResponse.json({
            used_bytes: usedBytes,
            limit_bytes: limitBytes,
            used_mb: Math.round((usedBytes / 1048576) * 10) / 10,
            limit_mb: Math.round(limitBytes / 1048576),
            percentage: Math.round((usedBytes / limitBytes) * 100),
            is_over_warning: isOverWarning,
            is_over_limit: isOverLimit,
            auto_delete_after: storage?.auto_delete_after || null,
        });
    } catch (error: any) {
        console.error("Storage check error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Buy more storage
export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { amount_mb } = await request.json();

        if (!amount_mb || amount_mb < 50 || amount_mb % 50 !== 0) {
            return NextResponse.json(
                { error: "כמות לא תקינה. המינימום הוא 50MB ובכפולות של 50." },
                { status: 400 }
            );
        }

        // Calculate cost: (amount / 50) * 15
        const creditsCost = (amount_mb / BASE_MB) * BASE_COST;
        const additionalBytes = amount_mb * 1048576;

        const admin = createSupabaseAdmin(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Check credits
        const { data: credits } = await admin
            .from("credits")
            .select("credits")
            .eq("user_id", user.id)
            .single();

        if (!credits || credits.credits < creditsCost) {
            return NextResponse.json(
                { error: `אין מספיק קרדיטים. נדרשים ${creditsCost} קרדיטים.` },
                { status: 400 }
            );
        }

        // Deduct credits
        const { data: newBalance, error: deductError } = await admin.rpc("deduct_credits", {
            p_user_id: user.id,
            p_cost: creditsCost,
        });

        if (deductError) {
            return NextResponse.json(
                { error: "שגיאה בניכוי קרדיטים" },
                { status: 500 }
            );
        }

        // Log transaction
        await admin.from("credit_transactions").insert({
            user_id: user.id,
            amount: -creditsCost,
            balance_after: newBalance,
            credit_type: "deduction",
            cost_type: "storage_purchase",
            reason: `רכישת ${amount_mb}MB אחסון נוסף`,
        });

        // Increase storage limit
        const { data: storage } = await admin
            .from("user_storage")
            .select("*")
            .eq("user_id", user.id)
            .single();

        const currentLimit = storage?.limit_bytes || STORAGE_LIMIT_BYTES;
        const newLimit = currentLimit + additionalBytes;

        await admin
            .from("user_storage")
            .upsert({
                user_id: user.id,
                limit_bytes: newLimit,
                warning_sent_at: null,
                auto_delete_after: null,
                updated_at: new Date().toISOString(),
            });

        // Send confirmation notification
        await admin.from("notifications").insert({
            user_id: user.id,
            type: "billing",
            title: "✅ אחסון נוסף נרכש!",
            body: `נוספו ${amount_mb}MB לאחסון שלך. המכסה החדשה: ${formatBytes(newLimit)}.`,
            metadata: { amount_mb, credits_spent: creditsCost, new_limit: newLimit },
        });

        return NextResponse.json({
            success: true,
            new_limit_bytes: newLimit,
            new_limit_mb: Math.round(newLimit / 1048576),
            credits_spent: creditsCost,
            credits_remaining: newBalance,
        });
    } catch (error: any) {
        console.error("Storage purchase error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

function formatBytes(bytes: number): string {
    if (bytes < 1048576) return `${Math.round(bytes / 1024)}KB`;
    return `${Math.round((bytes / 1048576) * 10) / 10}MB`;
}