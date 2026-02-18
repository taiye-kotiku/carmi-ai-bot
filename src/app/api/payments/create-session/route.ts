// src/app/api/payments/create-session/route.ts
// Lemon Squeezy checkout (test mode for payment testing)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lemonSqueezy } from "@/lib/lemonsqueezy/client";
import { getPlanById } from "@/lib/plans";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { planId } = await request.json();

        if (!planId) {
            return NextResponse.json(
                { error: "Missing planId" },
                { status: 400 }
            );
        }

        const plan = getPlanById(planId);
        if (!plan) {
            return NextResponse.json(
                { error: "Invalid plan" },
                { status: 400 }
            );
        }

        if (!plan.variantId) {
            return NextResponse.json(
                { error: "Lemon Squeezy variant not configured for this plan. Set LEMONSQUEEZY_VARIANT_* env vars." },
                { status: 500 }
            );
        }

        const storeId = process.env.LEMONSQUEEZY_STORE_ID;
        if (!storeId) {
            return NextResponse.json(
                { error: "LEMONSQUEEZY_STORE_ID not configured" },
                { status: 500 }
            );
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("email, name")
            .eq("id", user.id)
            .single();

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const redirectUrl = `${appUrl}/credits/success?order=[order_id]`;

        const response = await lemonSqueezy.createCheckout({
            storeId,
            variantId: plan.variantId,
            customPrice: Math.round(plan.price * 100), // cents
            productOptions: {
                redirect_url: redirectUrl,
            },
            checkoutData: {
                email: profile?.email || user.email || "",
                name: profile?.name || "",
                custom: {
                    user_id: user.id,
                },
            },
            testMode: true, // Test mode for payment testing
        });

        const checkoutUrl = response.data.attributes.url;
        if (!checkoutUrl) {
            return NextResponse.json(
                { error: "Failed to get checkout URL" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            url: checkoutUrl,
            orderId: null, // Order ID comes from redirect after payment
        });
    } catch (error) {
        console.error("Payment session creation failed:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to create checkout",
            },
            { status: 500 }
        );
    }
}
