import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { lemonSqueezy } from '@/lib/lemonsqueezy/client';

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { variantId, customPrice } = await request.json();

        if (!variantId) {
            return NextResponse.json(
                { error: 'Variant ID is required' },
                { status: 400 }
            );
        }

        // Get user profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('email, name')
            .eq('id', user.id)
            .single();

        // Create checkout
        const response = await lemonSqueezy.createCheckout({
            storeId: process.env.LEMONSQUEEZY_STORE_ID!,
            variantId,
            customPrice,
            checkoutData: {
                email: profile?.email || user.email || '',
                name: profile?.name || '',
                custom: {
                    user_id: user.id,
                },
            },
        });

        return NextResponse.json({
            checkoutUrl: response.data.attributes.url,
        });
    } catch (error) {
        console.error('Error creating Lemon Squeezy checkout:', error);
        return NextResponse.json(
            { error: 'Failed to create checkout' },
            { status: 500 }
        );
    }
}