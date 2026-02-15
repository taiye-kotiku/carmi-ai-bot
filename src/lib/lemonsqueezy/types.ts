export interface LemonSqueezyStore {
    type: 'stores';
    id: string;
    attributes: {
        name: string;
        slug: string;
        domain: string;
        url: string;
        avatar_url: string;
        plan: string;
        country: string;
        country_nicename: string;
        currency: string;
        total_sales: number;
        total_revenue: number;
        thirty_day_sales: number;
        thirty_day_revenue: number;
        created_at: string;
        updated_at: string;
    };
}

export interface LemonSqueezyProduct {
    type: 'products';
    id: string;
    attributes: {
        store_id: number;
        name: string;
        slug: string;
        description: string;
        status: 'draft' | 'published';
        status_formatted: string;
        thumb_url: string | null;
        large_thumb_url: string | null;
        price: number;
        price_formatted: string;
        from_price: number | null;
        to_price: number | null;
        pay_what_you_want: boolean;
        buy_now_url: string;
        created_at: string;
        updated_at: string;
        test_mode: boolean;
    };
}

export interface LemonSqueezyVariant {
    type: 'variants';
    id: string;
    attributes: {
        product_id: number;
        name: string;
        slug: string;
        description: string;
        price: number;
        is_subscription: boolean;
        interval: 'day' | 'week' | 'month' | 'year' | null;
        interval_count: number | null;
        has_free_trial: boolean;
        trial_interval: 'day' | 'week' | 'month' | 'year';
        trial_interval_count: number;
        pay_what_you_want: boolean;
        min_price: number;
        suggested_price: number;
        status: 'pending' | 'draft' | 'published';
        status_formatted: string;
        created_at: string;
        updated_at: string;
        test_mode: boolean;
    };
}

export interface LemonSqueezyCheckout {
    type: 'checkouts';
    id: string;
    attributes: {
        store_id: number;
        variant_id: number;
        custom_price: number | null;
        product_options: Record<string, any>;
        checkout_options: Record<string, any>;
        checkout_data: Record<string, any>;
        preview: {
            currency: string;
            currency_rate: number;
            subtotal: number;
            discount_total: number;
            tax: number;
            total: number;
            subtotal_usd: number;
            discount_total_usd: number;
            tax_usd: number;
            total_usd: number;
            subtotal_formatted: string;
            discount_total_formatted: string;
            tax_formatted: string;
            total_formatted: string;
        };
        expires_at: string | null;
        created_at: string;
        updated_at: string;
        test_mode: boolean;
        url: string;
    };
}

export interface LemonSqueezyOrder {
    type: 'orders';
    id: string;
    attributes: {
        store_id: number;
        customer_id: number;
        identifier: string;
        order_number: number;
        user_name: string;
        user_email: string;
        currency: string;
        currency_rate: string;
        subtotal: number;
        discount_total: number;
        tax: number;
        total: number;
        subtotal_usd: number;
        discount_total_usd: number;
        tax_usd: number;
        total_usd: number;
        tax_name: string;
        tax_rate: string;
        status: 'pending' | 'failed' | 'paid' | 'refunded';
        status_formatted: string;
        refunded: boolean;
        refunded_at: string | null;
        subtotal_formatted: string;
        discount_total_formatted: string;
        tax_formatted: string;
        total_formatted: string;
        first_order_item: {
            id: number;
            order_id: number;
            product_id: number;
            variant_id: number;
            product_name: string;
            variant_name: string;
            price: number;
            created_at: string;
            updated_at: string;
            test_mode: boolean;
        };
        urls: {
            receipt: string;
        };
        created_at: string;
        updated_at: string;
        test_mode: boolean;
    };
}

export interface LemonSqueezySubscription {
    type: 'subscriptions';
    id: string;
    attributes: {
        store_id: number;
        customer_id: number;
        order_id: number;
        order_item_id: number;
        product_id: number;
        variant_id: number;
        product_name: string;
        variant_name: string;
        user_name: string;
        user_email: string;
        status: 'on_trial' | 'active' | 'paused' | 'past_due' | 'unpaid' | 'cancelled' | 'expired';
        status_formatted: string;
        card_brand: string;
        card_last_four: string;
        pause: {
            mode: 'void' | 'free';
            resumes_at: string | null;
        } | null;
        cancelled: boolean;
        trial_ends_at: string | null;
        billing_anchor: number;
        urls: {
            update_payment_method: string;
            customer_portal: string;
        };
        renews_at: string;
        ends_at: string | null;
        created_at: string;
        updated_at: string;
        test_mode: boolean;
    };
}

export interface LemonSqueezyWebhookPayload {
    meta: {
        event_name: string;
        custom_data: Record<string, any>;
    };
    data: LemonSqueezyOrder | LemonSqueezySubscription | any;
}