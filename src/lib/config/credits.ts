// src/lib/config/credits.ts

export const CREDIT_COSTS = {
    image_generation: 5,
    carousel_generation: 0, // חינם
    video_generation: 25,
    caricature_generation: 5,
    character_training: 50,
    video_clips: 25,
    video_to_images: 25,
    storage_expansion: 15,
    story_generation: 15, // multiple 9:16 images + 1 short video
    creative_hub: 0, // placeholder - use customAmount for total
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;

export const CREDIT_ACTION_LABELS: Record<CreditAction, string> = {
    image_generation: "יצירת תמונה",
    carousel_generation: "יצירת קרוסלה",
    video_generation: "יצירת וידאו",
    caricature_generation: "יצירת קריקטורה",
    character_training: "אימון דמות",
    video_clips: "יצירת רילז וירליים מוידאו",
    video_to_images: "תמונות נבחרות מוידאו",
    storage_expansion: "הרחבת אחסון (50MB)",
    story_generation: "יצירת סטורי",
    creative_hub: "מרכז יצירתי",
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