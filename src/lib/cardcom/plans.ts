// src/lib/cardcom/plans.ts

import { CreditPlan } from "./types";

export const CREDIT_PLANS: CreditPlan[] = [
    {
        id: "starter",
        name: "Starter",
        nameHe: "סטארטר",
        credits: 50,
        price: 29,
        pricePerCredit: 0.58,
        features: [
            "50 קרדיטים",
            "תמונות AI",
            "קרוסלות",
            "תמיכה בצ׳אט",
        ],
    },
    {
        id: "creator",
        name: "Creator",
        nameHe: "קריאייטור",
        credits: 150,
        price: 69,
        pricePerCredit: 0.46,
        popular: true,
        savings: "חיסכון של 21%",
        features: [
            "150 קרדיטים",
            "תמונות AI",
            "קרוסלות",
            "וידאו AI",
            "דמויות מותאמות",
            "תמיכה מועדפת",
        ],
    },
    {
        id: "pro",
        name: "Pro",
        nameHe: "פרו",
        credits: 400,
        price: 149,
        pricePerCredit: 0.37,
        savings: "חיסכון של 36%",
        features: [
            "400 קרדיטים",
            "כל הכלים",
            "וידאו AI מתקדם",
            "דמויות ללא הגבלה",
            "תמיכה VIP",
            "גישה מוקדמת לפיצ׳רים",
        ],
    },
    {
        id: "business",
        name: "Business",
        nameHe: "עסקי",
        credits: 1000,
        price: 299,
        pricePerCredit: 0.30,
        savings: "חיסכון של 48%",
        features: [
            "1000 קרדיטים",
            "כל הכלים ללא הגבלה",
            "API גישה",
            "מנהל חשבון ייעודי",
            "תמיכה 24/7",
            "התאמה אישית",
        ],
    },
];

export function getPlanById(planId: string): CreditPlan | undefined {
    return CREDIT_PLANS.find((p) => p.id === planId);
}