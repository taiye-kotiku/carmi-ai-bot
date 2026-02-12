// src/app/api/webhooks/cardcom/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLowProfileResult } from "@/lib/cardcom/client";
import type { CardcomWebhookPayload } from "@/lib/cardcom/types";

/**
 * Cardcom WebHook endpoint
 * Called by Cardcom after a payment is completed.
 * Cardcom sends JSON POST to this URL.
 */
export async function POST(request: NextRequest) {
    try {
        // 1. Parse the webhook JSON payload
        const payload: CardcomWebhookPayload = await request.json();

        console.log("[Cardcom Webhook] Received:", JSON.stringify({
            ResponseCode: payload.ResponseCode,
            Description: payload.Description,
            TranzactionId: payload.TranzactionId,
            ReturnValue: payload.ReturnValue,
            Operation: payload.Operation,
            Amount: payload.TranzactionInfo?.Amount,
        }, null, 2));

        // 2. Check if the transaction was successful
        if (payload.ResponseCode !== 0) {
            console.error("[Cardcom Webhook] Transaction failed:", {
                code: payload.ResponseCode,
                description: payload.Description,
                returnValue: payload.ReturnValue,
            });

            // Update order status if we have the order ID
            if (payload.ReturnValue) {
                const adminClient = createAdminClient();
                await adminClient
                    .from("payment_orders")
                    .update({
                        status: "failed",
                        error_message: `Cardcom error ${payload.ResponseCode}: ${payload.Description}`,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", payload.ReturnValue);
            }

            return NextResponse.json({ status: "payment_failed" });
        }

        // 3. Extract order ID from ReturnValue
        const orderId = payload.ReturnValue;
        if (!orderId) {
            console.error("[Cardcom Webhook] Missing ReturnValue (order ID)");
            return NextResponse.json(
                { error: "Missing ReturnValue" },
                { status: 400 }
            );
        }

        const adminClient = createAdminClient();

        // 4. Look up the order to get user_id, plan_id, credits
        const { data: order, error: orderError } = await adminClient
            .from("payment_orders")
            .select("*")
            .eq("id", orderId)
            .single();

        if (orderError || !order) {
            console.error("[Cardcom Webhook] Order not found:", orderId, orderError);
            return NextResponse.json(
                { error: "Order not found" },
                { status: 404 }
            );
        }

        // 5. Idempotency check — don't process twice
        if (order.status === "completed") {
            console.log("[Cardcom Webhook] Order already completed:", orderId);
            return NextResponse.json({ status: "already_processed" });
        }

        // 6. Verify the payment amount matches
        const paidAmount = payload.TranzactionInfo?.Amount;
        if (paidAmount !== undefined && paidAmount !== order.amount) {
            console.error("[Cardcom Webhook] Amount mismatch!", {
                expected: order.amount,
                received: paidAmount,
                orderId,
            });

            await adminClient
                .from("payment_orders")
                .update({
                    status: "amount_mismatch",
                    error_message: `Expected ${order.amount}, got ${paidAmount}`,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", orderId);

            return NextResponse.json(
                { error: "Amount mismatch" },
                { status: 400 }
            );
        }

        // 7. Double-verify with Cardcom API (optional but recommended)
        if (order.lowprofile_id) {
            try {
                const verification = await getLowProfileResult(order.lowprofile_id);
                if (verification.ResponseCode !== 0) {
                    console.error("[Cardcom Webhook] Verification failed:", verification);
                    await adminClient
                        .from("payment_orders")
                        .update({
                            status: "verification_failed",
                            error_message: `Verification: ${verification.Description}`,
                            updated_at: new Date().toISOString(),
                        })
                        .eq("id", orderId);

                    return NextResponse.json(
                        { error: "Payment verification failed" },
                        { status: 400 }
                    );
                }
                console.log("[Cardcom Webhook] Payment verified via GetLpResult ✓");
            } catch (verifyError) {
                // Log but don't block — webhook itself is trustworthy
                console.warn("[Cardcom Webhook] Verification API call failed:", verifyError);
            }
        }

        // 8. Add credits to user
        const { data: newBalance, error: creditError } = await adminClient.rpc(
            "add_credits",
            {
                p_user_id: order.user_id,
                p_amount: order.credits,
            }
        );

        if (creditError) {
            console.error("[Cardcom Webhook] Failed to add credits:", creditError);

            await adminClient
                .from("payment_orders")
                .update({
                    status: "credit_error",
                    error_message: creditError.message,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", orderId);

            return NextResponse.json(
                { error: "Failed to add credits" },
                { status: 500 }
            );
        }

        // 9. Record the credit transaction
        await adminClient.from("credit_transactions").insert({
            user_id: order.user_id,
            amount: order.credits,
            balance_after: newBalance ?? order.credits,
            credit_type: "purchase",
            reason: `רכישת ${order.credits} קרדיטים - תוכנית ${order.plan_id}`,
            related_id: orderId,
            cost_type: "purchase",
        });

        // 10. Update order to completed
        await adminClient
            .from("payment_orders")
            .update({
                status: "completed",
                deal_id: payload.TranzactionId
                    ? String(payload.TranzactionId)
                    : null,
                approval_number:
                    payload.TranzactionInfo?.ApprovalNumber || null,
                card_last4:
                    payload.TranzactionInfo?.Last4CardDigitsString || null,
                card_owner_name:
                    payload.TranzactionInfo?.CardOwnerName || null,
                card_owner_email:
                    payload.TranzactionInfo?.CardOwnerEmail || null,
                document_url:
                    payload.TranzactionInfo?.DocumentUrl ||
                    payload.DocumentInfo?.DocumentUrl ||
                    null,
                verified_amount: paidAmount ?? null,
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("id", orderId);

        // 11. Send notification to user
        await adminClient.from("notifications").insert({
            user_id: order.user_id,
            type: "payment",
            title: "תשלום התקבל בהצלחה! 🎉",
            body: `${order.credits} קרדיטים נוספו לחשבונך.`,
            metadata: {
                orderId,
                credits: order.credits,
                planId: order.plan_id,
                amount: order.amount,
            },
        });

        console.log(
            `[Cardcom Webhook] ✅ Payment completed: user=${order.user_id}, credits=${order.credits}, order=${orderId}, balance=${newBalance}`
        );

        return NextResponse.json({
            status: "success",
            credits: newBalance,
        });
    } catch (error) {
        console.error("[Cardcom Webhook] Processing error:", error);
        return NextResponse.json(
            { error: "Webhook processing failed" },
            { status: 500 }
        );
    }
}

// Cardcom may ping with GET to verify URL is accessible
export async function GET() {
    return NextResponse.json({ status: "ok", service: "cardcom-webhook" });
}