// src/lib/config/credits.ts

export const CREDIT_COSTS = {
    image_generation: 3,
    carousel_generation: 3,
    video_generation: 25,
    caricature_generation: 3,
    character_training: 50,
    video_clips: 25,
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;

export const CREDIT_ACTION_LABELS: Record<CreditAction, string> = {
    image_generation: "יצירת תמונה",
    carousel_generation: "יצירת קרוסלה",
    video_generation: "יצירת וידאו",
    caricature_generation: "יצירת קריקטורה",
    character_training: "אימון דמות",
    video_clips: "חיתוך וידאו",
};

export const PLANS = {
    free: {
        id: "free",
        name: "Free",
        nameHe: "חינמי",
        monthlyCredits: 30,
        priceMonthly: 0,
        priceYearly: 0,
    },
    basic: {
        id: "basic",
        name: "Basic",
        nameHe: "בסיסי",
        monthlyCredits: 300,
        priceMonthly: 139,
        priceYearly: 1529,
    },
    pro: {
        id: "pro",
        name: "Pro",
        nameHe: "מקצועי",
        monthlyCredits: 600,
        priceMonthly: 229,
        priceYearly: 2519,
    },
} as const;

export type PlanId = keyof typeof PLANS;

export function canAfford(currentCredits: number, action: CreditAction): boolean {
    return currentCredits >= CREDIT_COSTS[action];
}

export function getCost(action: CreditAction): number {
    return CREDIT_COSTS[action];
}