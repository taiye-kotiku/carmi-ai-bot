/**
 * Connection health check: Supabase, Modal, and webhook URL.
 * GET /api/health/connections - returns status of each connection.
 * Useful for debugging integration issues.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
    const results: Record<string, { ok: boolean; message?: string }> = {};

    // 1. Supabase connection
    try {
        const { supabaseAdmin } = await import("@/lib/supabase/admin");
        const { error } = await supabaseAdmin
            .from("characters")
            .select("id")
            .limit(1);

        results.supabase = error
            ? { ok: false, message: error.message }
            : { ok: true };
    } catch (e) {
        results.supabase = {
            ok: false,
            message: e instanceof Error ? e.message : "Connection failed",
        };
    }

    // 2. Modal training URL configured and reachable
    const modalUrl =
        process.env.MODAL_TRAINING_URL || process.env.MODAL_TRAIN_ENDPOINT_URL;
    if (!modalUrl) {
        results.modal_training = {
            ok: false,
            message: "MODAL_TRAINING_URL or MODAL_TRAIN_ENDPOINT_URL not set",
        };
    } else {
        try {
            // Send minimal POST - will fail validation but proves endpoint is reachable
            const res = await fetch(modalUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
                signal: AbortSignal.timeout(15000),
            });
            const text = await res.text();
            // 200 = accepted; 400 = validation error (endpoint reached); 500 = server error
            const reached = res.status < 500;
            results.modal_training = reached
                ? { ok: true }
                : {
                      ok: false,
                      message: `HTTP ${res.status}${text ? `: ${text.slice(0, 100)}` : ""}`,
                  };
        } catch (e) {
            results.modal_training = {
                ok: false,
                message: e instanceof Error ? e.message : "Request failed (check URL, CORS, network)",
            };
        }
    }

    // 3. Webhook URL configuration
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
        results.webhook_url = {
            ok: false,
            message: "NEXT_PUBLIC_APP_URL not set — webhook will fail",
        };
    } else {
        const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/webhooks/training-complete`;
        results.webhook_url = {
            ok: true,
            message: webhookUrl,
        };
    }

    // 4. Supabase storage bucket (loras) - check if we can list (optional)
    try {
        const { supabaseAdmin } = await import("@/lib/supabase/admin");
        const { error } = await supabaseAdmin.storage
            .from("loras")
            .list("", { limit: 1 });

        results.supabase_storage_loras = error
            ? {
                  ok: false,
                  message: error.message.includes("not found")
                      ? "Bucket 'loras' does not exist — create it in Supabase Storage"
                      : error.message,
              }
            : { ok: true };
    } catch (e) {
        results.supabase_storage_loras = {
            ok: false,
            message: e instanceof Error ? e.message : "Check failed",
        };
    }

    const allOk = Object.values(results).every((r) => r.ok);
    return NextResponse.json(
        {
            ok: allOk,
            timestamp: new Date().toISOString(),
            checks: results,
        },
        { status: allOk ? 200 : 503 }
    );
}
