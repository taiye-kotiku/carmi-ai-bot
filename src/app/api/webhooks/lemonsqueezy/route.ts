import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPlanByVariantId } from '@/lib/lemonsqueezy/plans';

interface LemonSqueezyWebhook {
    meta: {
        event_name: string;
        custom_data?: {
            user_id?: string;
        };
    };
    data: {
        type: string;
        id: string;
        attributes: any;
    };
}

function verifySignature(payload: string, signature: string): boolean {
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET!;
    const hmac = crypto.createHmac('sha256', secret);
    const digest = Buffer.from(hmac.update(payload).digest('hex'), 'utf8');
    const signatureBuffer = Buffer.from(signature, 'utf8');

    return crypto.timingSafeEqual(digest, signatureBuffer);
}

export async function POST(request: NextRequest) {
    try {
        const signature = request.headers.get('x-signature');
        const rawBody = await request.text();

        if (!signature || !verifySignature(rawBody, signature)) {
            console.error('[Lemon Squeezy Webhook] Invalid signature');
            return NextResponse.json(
                { error: 'Invalid signature' },
                { status: 401 }
            );
        }

        const payload: LemonSqueezyWebhook = JSON.parse(rawBody);
        const eventName = payload.meta.event_name;

        console.log('[Lemon Squeezy Webhook] Received:', eventName, {
            type: payload.data.type,
            id: payload.data.id,
        });

        const adminClient = createAdminClient();
        const userId = payload.meta.custom_data?.user_id;

        switch (eventName) {
            case 'order_created': {
                if (!userId) {
                    console.error('[Lemon Squeezy Webhook] No user_id in custom_data');
                    break;
                }

                const order = payload.data.attributes;
                const variantId = order.first_order_item.variant_id.toString();
                const plan = getPlanByVariantId(variantId);

                if (!plan) {
                    console.error('[Lemon Squeezy Webhook] Unknown variant ID:', variantId);
                    break;
                }

                console.log('[Lemon Squeezy Webhook] Processing order:', {
                    orderId: payload.data.id,
                    userId,
                    plan: plan.id,
                    credits: plan.credits,
                });

                // Add credits to user
                const { data: newBalance, error: creditError } = await adminClient.rpc(
                    'add_credits',
                    {
                        p_user_id: userId,
                        p_amount: plan.credits,
                    }
                );

                if (creditError) {
                    console.error('[Lemon Squeezy Webhook] Failed to add credits:', creditError);
                    throw creditError;
                }

                // Record the credit transaction
                await adminClient.from('credit_transactions').insert({
                    user_id: userId,
                    amount: plan.credits,
                    balance_after: newBalance ?? plan.credits,
                    credit_type: 'purchase',
                    reason: `Lemon Squeezy purchase - ${plan.name} plan`,
                    related_id: payload.data.id,
                    cost_type: 'purchase',
                });

                // Send notification
                await adminClient.from('notifications').insert({
                    user_id: userId,
                    type: 'payment',
                    title: 'Payment successful! 🎉',
                    body: `${plan.credits} credits added to your account.`,
                    metadata: {
                        orderId: payload.data.id,
                        credits: plan.credits,
                        planId: plan.id,
                        amount: order.total,
                    },
                });

                console.log(
                    `[Lemon Squeezy Webhook] ✅ Order processed: user=${userId}, credits=${plan.credits}, balance=${newBalance}`
                );

                break;
            }

            case 'subscription_created':
            case 'subscription_updated': {
                if (!userId) {
                    console.error('[Lemon Squeezy Webhook] No user_id in custom_data');
                    break;
                }

                const subscription = payload.data.attributes;

                // Update or create subscription record
                await adminClient.from('subscriptions').upsert({
                    id: payload.data.id,
                    user_id: userId,
                    payplus_subscription_id: payload.data.id, // Reusing this field for Lemon Squeezy ID
                    plan_name: subscription.variant_name,
                    status: subscription.status,
                    current_period_start: subscription.created_at,
                    current_period_end: subscription.renews_at,
                    cancel_at: subscription.ends_at,
                });

                console.log('[Lemon Squeezy Webhook] Subscription updated:', payload.data.id);
                break;
            }

            case 'subscription_payment_success': {
                if (!userId) {
                    console.error('[Lemon Squeezy Webhook] No user_id in custom_data');
                    break;
                }

                // For subscription renewals, we need to get the subscription to find the variant
                const invoice = payload.data.attributes;

                // You may need to fetch the subscription details to get variant_id
                // For now, we'll skip adding credits on renewal
                // You can implement this by storing variant_id in the subscription record

                console.log('[Lemon Squeezy Webhook] Subscription payment success:', payload.data.id);
                break;
            }

            case 'subscription_cancelled':
            case 'subscription_expired': {
                if (!userId) {
                    console.error('[Lemon Squeezy Webhook] No user_id in custom_data');
                    break;
                }

                const subscription = payload.data.attributes;

                // Update subscription status
                await adminClient
                    .from('subscriptions')
                    .update({
                        status: subscription.status,
                        cancel_at: subscription.ends_at,
                    })
                    .eq('payplus_subscription_id', payload.data.id);

                console.log('[Lemon Squeezy Webhook] Subscription status updated:', {
                    id: payload.data.id,
                    status: subscription.status,
                });
                break;
            }
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('[Lemon Squeezy Webhook] Processing error:', error);
        return NextResponse.json(
            { error: 'Webhook processing failed' },
            { status: 500 }
        );
    }
}

// Health check
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        service: 'lemonsqueezy-webhook'
    });
}