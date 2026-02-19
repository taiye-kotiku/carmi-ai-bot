export type Plan = {
    id: string;
    name: string;
    price: number;
    currency: string;
    currencySymbol: string;
    credits: number;
    variantId?: string;
    isFree?: boolean;
};

export const CURRENCY = "ILS";
export const CURRENCY_SYMBOL = "₪";

export const FREE_TRIAL_CREDITS = 40;
export const FREE_TRIAL_DAYS = 7;

export const plans: Plan[] = [
    {
        id: "free_trial",
        name: "Free Trial",
        price: 0,
        currency: CURRENCY,
        currencySymbol: CURRENCY_SYMBOL,
        credits: FREE_TRIAL_CREDITS,
        isFree: true,
    },
    {
        id: "starter",
        name: "Starter",
        price: 99,
        currency: CURRENCY,
        currencySymbol: CURRENCY_SYMBOL,
        credits: 150,
        variantId: process.env.NEXT_PUBLIC_LEMONSQUEEZY_VARIANT_STARTER,
    },
    {
        id: "creator",
        name: "Creator",
        price: 139,
        currency: CURRENCY,
        currencySymbol: CURRENCY_SYMBOL,
        credits: 300,
        variantId: process.env.NEXT_PUBLIC_LEMONSQUEEZY_VARIANT_CREATOR,
    },
    {
        id: "pro",
        name: "Pro",
        price: 229,
        currency: CURRENCY,
        currencySymbol: CURRENCY_SYMBOL,
        credits: 600,
        variantId: process.env.NEXT_PUBLIC_LEMONSQUEEZY_VARIANT_PRO,
    },
];

export function formatPrice(price: number): string {
    if (price === 0) return "Free";
    return `${price}${CURRENCY_SYMBOL}`;
}

export function getPlanByVariantId(variantId: string): Plan | undefined {
    return plans.find((plan) => plan.variantId === variantId);
}

export function getPlanById(id: string): Plan | undefined {
    return plans.find((plan) => plan.id === id);
}

export function getActivePlans(): Plan[] {
    return plans.filter((plan) => !plan.isFree);
}

// Alias for backward compatibility
export const CREDIT_PLANS = getActivePlans();