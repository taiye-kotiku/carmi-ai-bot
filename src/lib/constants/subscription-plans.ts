// Subscription plan credit allocations
export const SUBSCRIPTION_PLANS = {
    free: {
        name: "חינם",
        credits: 24,
        monthlyPrice: 0,
    },
    basic: {
        name: "בסיסי",
        credits: 300,
        monthlyPrice: 139,
    },
    pro: {
        name: "מקצועי",
        credits: 600,
        monthlyPrice: 229,
    },
} as const;

// Credit costs for different features
export const CREDIT_COSTS = {
    image: 3,
    carousel: 3,
    video: 25,
    caricature: 3,
    characterTraining: 50,
    reelConversion: 4,
    videoSlicing: 25,
} as const;
