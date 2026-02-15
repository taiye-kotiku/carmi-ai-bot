export interface LemonSqueezyPlan {
    id: string;
    variantId: string;
    name: string;
    price: number;
    credits: number;
    interval: 'month' | 'year';
    features: string[];
}

export const LEMONSQUEEZY_PLANS: LemonSqueezyPlan[] = [
    {
        id: 'basic',
        variantId: process.env.NEXT_PUBLIC_LEMONSQUEEZY_VARIANT_BASIC || '',
        name: 'Basic',
        price: 29,
        credits: 100,
        interval: 'month',
        features: [
            '100 credits per month',
            'All AI features',
            'Basic support',
        ],
    },
    {
        id: 'pro',
        variantId: process.env.NEXT_PUBLIC_LEMONSQUEEZY_VARIANT_PRO || '',
        name: 'Pro',
        price: 79,
        credits: 300,
        interval: 'month',
        features: [
            '300 credits per month',
            'All AI features',
            'Priority support',
            'Advanced templates',
        ],
    },
    {
        id: 'premium',
        variantId: process.env.NEXT_PUBLIC_LEMONSQUEEZY_VARIANT_PREMIUM || '',
        name: 'Premium',
        price: 199,
        credits: 1000,
        interval: 'month',
        features: [
            '1000 credits per month',
            'All AI features',
            'Priority support',
            'Advanced templates',
            'Custom branding',
        ],
    },
];

export function getPlanByVariantId(variantId: string): LemonSqueezyPlan | undefined {
    return LEMONSQUEEZY_PLANS.find(plan => plan.variantId === variantId);
}