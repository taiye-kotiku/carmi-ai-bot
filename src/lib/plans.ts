export type Plan = {
    id: string;
    name: string;
    nameHe: string;
    price: number;
    currency: string;
    currencySymbol: string;
    credits: number;
    pricePerCredit: number;
    variantId?: string;
    isFree?: boolean;
    popular?: boolean;
    savings?: string;
    features: string[];
};

export const CURRENCY = "ILS";
export const CURRENCY_SYMBOL = "₪";

export const FREE_TRIAL_CREDITS = 40;
export const FREE_TRIAL_DAYS = 7;

export const plans: Plan[] = [
    {
        id: "free_trial",
        name: "Free Trial",
        nameHe: "ניסיון חינם",
        price: 0,
        currency: CURRENCY,
        currencySymbol: CURRENCY_SYMBOL,
        credits: FREE_TRIAL_CREDITS,
        pricePerCredit: 0,
        isFree: true,
        features: [
            "40 קרדיטים לניסיון",
            "גישה לכל הכלים",
            "תוקף ל-7 ימים",
        ],
    },
    {
        id: "starter",
        name: "Starter",
        nameHe: "סטארטר",
        price: 99,
        currency: CURRENCY,
        currencySymbol: CURRENCY_SYMBOL,
        credits: 150,
        pricePerCredit: parseFloat((99 / 150).toFixed(3)),
        variantId: process.env.NEXT_PUBLIC_LEMONSQUEEZY_VARIANT_STARTER,
        features: [
            "150 קרדיטים לשימוש",
            "יצירת עד 10 תמונות",
            "גישה לכל הכלים",
            "תמיכה בסיסית",
        ],
    },
    {
        id: "creator",
        name: "Creator",
        nameHe: "יוצר",
        price: 139,
        currency: CURRENCY,
        currencySymbol: CURRENCY_SYMBOL,
        credits: 300,
        pricePerCredit: parseFloat((139 / 300).toFixed(3)),
        variantId: process.env.NEXT_PUBLIC_LEMONSQUEEZY_VARIANT_CREATOR,
        popular: true,
        savings: "חיסכון 30%",
        features: [
            "300 קרדיטים לשימוש",
            "יצירת עד 20 תמונות",
            "גישה לכל הכלים",
            "חיסכון 30% לקרדיט",
            "תמיכה מועדפת",
        ],
    },
    {
        id: "pro",
        name: "Pro",
        nameHe: "פרו",
        price: 229,
        currency: CURRENCY,
        currencySymbol: CURRENCY_SYMBOL,
        credits: 600,
        pricePerCredit: parseFloat((229 / 600).toFixed(3)),
        variantId: process.env.NEXT_PUBLIC_LEMONSQUEEZY_VARIANT_PRO,
        savings: "חיסכון 42%",
        features: [
            "600 קרדיטים לשימוש",
            "יצירת עד 40 תמונות",
            "גישה לכל הכלים",
            "חיסכון 42% לקרדיט",
            "תמיכה פרימיום",
        ],
    },
];

export const CREDIT_PLANS = plans.filter((plan) => !plan.isFree);

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