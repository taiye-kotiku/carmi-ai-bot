import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database";

/**
 * Creates a Supabase client with the service role key.
 * This bypasses RLS — use only in server-side API routes.
 * NEVER expose this client to the browser.
 */
export function createAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error(
            "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
        );
    }

    return createClient<Database>(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

export const supabaseAdmin: SupabaseClient<Database> = createAdminClient();