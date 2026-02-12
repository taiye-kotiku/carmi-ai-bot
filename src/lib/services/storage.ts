import { supabaseAdmin } from "@/lib/supabase/admin";

const DEFAULT_LIMIT_BYTES = 104857600; // 100MB
const AUTO_DELETE_DAYS = 3;

/**
 * Update user storage after a generation completes.
 * Call this from any generation API route after uploading files.
 */
export async function updateUserStorage(
    userId: string,
    additionalBytes: number
): Promise<void> {
    try {
        const { data: storage } = await supabaseAdmin
            .from("user_storage")
            .select("*")
            .eq("user_id", userId)
            .single();

        if (storage) {
            const newUsed = (storage.used_bytes || 0) + additionalBytes;

            await supabaseAdmin
                .from("user_storage")
                .update({
                    used_bytes: newUsed,
                    updated_at: new Date().toISOString(),
                })
                .eq("user_id", userId);

            // Check warning threshold (80%)
            const limitBytes = storage.limit_bytes || DEFAULT_LIMIT_BYTES;
            const warningThreshold = Math.floor(limitBytes * 0.8);

            if (newUsed >= warningThreshold && !storage.warning_sent_at) {
                const isOverLimit = newUsed >= limitBytes;

                await supabaseAdmin.from("notifications").insert({
                    user_id: userId,
                    type: isOverLimit ? "storage_critical" : "storage_warning",
                    title: isOverLimit
                        ? "⚠️ האחסון שלך מלא!"
                        : "⚠️ האחסון שלך כמעט מלא",
                    body: isOverLimit
                        ? `השתמשת ב-${formatBytes(newUsed)} מתוך ${formatBytes(limitBytes)}. יצירות ישנות יימחקו אוטומטית בעוד ${AUTO_DELETE_DAYS} ימים.`
                        : `השתמשת ב-${formatBytes(newUsed)} מתוך ${formatBytes(limitBytes)}. שקול לרכוש אחסון נוסף.`,
                    metadata: { used_bytes: newUsed, limit_bytes: limitBytes },
                });

                await supabaseAdmin
                    .from("user_storage")
                    .update({
                        warning_sent_at: new Date().toISOString(),
                        auto_delete_after: isOverLimit
                            ? new Date(
                                Date.now() + AUTO_DELETE_DAYS * 24 * 60 * 60 * 1000
                            ).toISOString()
                            : null,
                    })
                    .eq("user_id", userId);
            }
        } else {
            // First time — create storage record
            await supabaseAdmin.from("user_storage").insert({
                user_id: userId,
                used_bytes: additionalBytes,
                limit_bytes: DEFAULT_LIMIT_BYTES,
            });
        }
    } catch (error) {
        // Don't throw — storage tracking failure shouldn't break generation
        console.error("Error updating user storage:", error);
    }
}

/**
 * Decrease user storage when files are manually deleted
 */
export async function decreaseUserStorage(
    userId: string,
    freedBytes: number
): Promise<void> {
    try {
        const { data: storage } = await supabaseAdmin
            .from("user_storage")
            .select("used_bytes")
            .eq("user_id", userId)
            .single();

        if (storage) {
            const newUsed = Math.max(0, (storage.used_bytes || 0) - freedBytes);

            await supabaseAdmin
                .from("user_storage")
                .update({
                    used_bytes: newUsed,
                    updated_at: new Date().toISOString(),
                    // Reset warning if we're back under threshold
                    ...(newUsed < DEFAULT_LIMIT_BYTES * 0.8
                        ? { warning_sent_at: null, auto_delete_after: null }
                        : {}),
                })
                .eq("user_id", userId);
        }
    } catch (error) {
        console.error("Error decreasing user storage:", error);
    }
}

/**
 * Recalculate user storage from actual generation records
 */
export async function recalculateUserStorage(userId: string): Promise<number> {
    try {
        const { data: generations } = await supabaseAdmin
            .from("generations")
            .select("file_size_bytes")
            .eq("user_id", userId)
            .eq("files_deleted", false);

        const totalBytes = (generations || []).reduce(
            (sum, g) => sum + (g.file_size_bytes || 0),
            0
        );

        await supabaseAdmin
            .from("user_storage")
            .upsert({
                user_id: userId,
                used_bytes: totalBytes,
                updated_at: new Date().toISOString(),
            });

        return totalBytes;
    } catch (error) {
        console.error("Error recalculating storage:", error);
        return 0;
    }
}

function formatBytes(bytes: number): string {
    if (bytes < 1048576) return `${Math.round(bytes / 1024)}KB`;
    return `${Math.round((bytes / 1048576) * 10) / 10}MB`;
}