// src/app/api/payments/verify/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Client-side verification endpoint
 * Called from the success page to check if payment was processed
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const orderId = request.nextUrl.searchParams.get("order");
        if (!orderId) {
            return NextResponse.json(
                { error: "Missing order ID" },
                { status: 400 }
            );
        }

        const adminClient = createAdminClient();
        const { data: order } = await adminClient
            .from("payment_orders")
            .select("*")
            .eq("id", orderId)
            .eq("user_id", user.id)
            .single();

        if (!order) {
            // Order not yet processed (webhook may not have fired)
            return NextResponse.json({
                status: "pending",
                credits: 0,
                planId: null,
            });
        }

        return NextResponse.json({
            status: order.status,
            credits: order.credits,
            planId: order.plan_id,
        });
    } catch (error) {
        console.error("Payment verify error:", error);
        return NextResponse.json(
            { error: "Verification failed" },
            { status: 500 }
        );
    }
}