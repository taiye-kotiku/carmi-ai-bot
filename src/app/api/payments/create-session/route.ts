// src/app/api/payments/create-session/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createLowProfile } from "@/lib/cardcom/client";
import { getPlanById } from "@/lib/cardcom/plans";
import { nanoid } from "nanoid";

export async function POST(request: NextRequest) {
    try {
        // 1. Authenticate user
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. Get plan from request
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

        // 3. Create order record in database
        const orderId = nanoid(16);
        const adminClient = createAdminClient();

        await adminClient.from("payment_orders").insert({
            id: orderId,
            user_id: user.id,
            plan_id: plan.id,
            credits: plan.credits,
            amount: plan.price,
            currency: "ILS",
            status: "pending",
        });

        // 4. Build URLs
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const successUrl = `${appUrl}/credits/success?order=${orderId}`;
        const failedUrl = `${appUrl}/credits/error?order=${orderId}`;
        const cancelUrl = `${appUrl}/credits?cancelled=true`;
        const webhookUrl = `${appUrl}/api/webhooks/cardcom`;

        // 5. Get user email for invoice
        const { data: profile } = await adminClient
            .from("profiles")
            .select("email, name")
            .eq("id", user.id)
            .single();

        // 6. Create Cardcom LowProfile payment page
        const lowProfile = await createLowProfile({
            amount: plan.price,
            productName: `קוסם - ${plan.nameHe} (${plan.credits} קרדיטים)`,
            successUrl,
            failedUrl,
            cancelUrl,
            webhookUrl,
            returnValue: orderId,
            customerEmail: profile?.email || user.email,
            customerName: profile?.name || undefined,
        });

        // 7. Update order with LowProfile details
        await adminClient
            .from("payment_orders")
            .update({
                lowprofile_id: lowProfile.LowProfileId,
                payment_url: lowProfile.Url,
            })
            .eq("id", orderId);

        // 8. Return the payment page URL
        return NextResponse.json({
            url: lowProfile.Url,
            orderId,
        });
    } catch (error) {
        console.error("Payment session creation failed:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to create payment session",
            },
            { status: 500 }
        );
    }
}