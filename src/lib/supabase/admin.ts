import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database";

let adminClientInstance: SupabaseClient<Database> | null = null;

/**
 * Creates a Supabase client with the service role key.
 * This bypasses RLS — use only in server-side API routes.
 * NEVER expose this client to the browser.
 */
export function createAdminClient(): SupabaseClient<Database> {
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

/**
 * Get or create the singleton admin client instance
 */
export function getSupabaseAdmin(): SupabaseClient<Database> {
    if (!adminClientInstance) {
        adminClientInstance = createAdminClient();
    }
    return adminClientInstance;
}

// Export singleton for backward compatibility
export const supabaseAdmin: SupabaseClient<Database> = getSupabaseAdmin();