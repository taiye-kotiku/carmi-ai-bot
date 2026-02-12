// src/lib/carousel/templates.ts
export interface CarouselTemplate {
    id: string;
    style: string;
    file: string;
    text_color: string;
    accent: string;
    y_pos: number;
    category: "tech" | "gradient" | "office" | "abstract" | "dark" | "nature" | "pastel";
}

export const CAROUSEL_TEMPLATES: Record<string, CarouselTemplate> = {
    // ─── Existing: Abstract / Buildings ──────────────────────────────
    "b1": { id: "b1", style: "בניין 1", file: "b1.jpg", text_color: "#FFFFFF", accent: "#F8FF00", y_pos: 400, category: "abstract" },
    "b2": { id: "b2", style: "בניין 2", file: "b2.jpg", text_color: "#FFFFFF", accent: "#F8FF00", y_pos: 400, category: "abstract" },
    "b3": { id: "b3", style: "בניין 3", file: "b3.jpg", text_color: "#FFFFFF", accent: "#F8FF00", y_pos: 400, category: "abstract" },
    "b4": { id: "b4", style: "בניין 4", file: "b4.jpg", text_color: "#FFFFFF", accent: "#F8FF00", y_pos: 400, category: "abstract" },
    "b5": { id: "b5", style: "בניין 5", file: "b5.jpg", text_color: "#FFFFFF", accent: "#F8FF00", y_pos: 400, category: "abstract" },
    "b6": { id: "b6", style: "בניין 6", file: "b6.jpg", text_color: "#FFFFFF", accent: "#F8FF00", y_pos: 400, category: "abstract" },

    // ─── Existing: Tech / Dark / Gradient / Office ──────────────────
    "T_02": { id: "T_02", style: "Abstract Purple", file: "T_02.jpg", text_color: "#1A1A1A", accent: "#2563EB", y_pos: 400, category: "gradient" },
    "T_04": { id: "T_04", style: "Smooth Gradient", file: "T_04.jpg", text_color: "#1A1A1A", accent: "#2563EB", y_pos: 675, category: "gradient" },
    "T_06": { id: "T_06", style: "Cyber Grid", file: "T_06.jpg", text_color: "#FFFFFF", accent: "#60A5FA", y_pos: 400, category: "dark" },
    "T_07": { id: "T_07", style: "Global Data", file: "T_07.jpg", text_color: "#FFFFFF", accent: "#60A5FA", y_pos: 400, category: "dark" },
    "T_10": { id: "T_10", style: "Hardware Close-up", file: "T_10.jpg", text_color: "#1A1A1A", accent: "#2563EB", y_pos: 400, category: "tech" },
    "T_11": { id: "T_11", style: "Modern Office", file: "T_11.jpg", text_color: "#1A1A1A", accent: "#2563EB", y_pos: 400, category: "office" },
    "T_12": { id: "T_12", style: "Skyscraper Lines", file: "T_12.jpg", text_color: "#1A1A1A", accent: "#2563EB", y_pos: 400, category: "office" },
    "T_18": { id: "T_18", style: "Circuit Board", file: "T_18.jpg", text_color: "#FFFFFF", accent: "#60A5FA", y_pos: 400, category: "tech" },
    "T_20": { id: "T_20", style: "Vibrant Mesh", file: "T_20.jpg", text_color: "#1A1A1A", accent: "#2563EB", y_pos: 400, category: "gradient" },
    "T_21": { id: "T_21", style: "Dark Landscape", file: "T_21.jpg", text_color: "#FFFFFF", accent: "#60A5FA", y_pos: 400, category: "dark" },
    "T_22": { id: "T_22", style: "Urban Night", file: "T_22.jpg", text_color: "#FFFFFF", accent: "#60A5FA", y_pos: 400, category: "dark" },
    "T_24": { id: "T_24", style: "Matrix Green", file: "T_24.jpg", text_color: "#FFFFFF", accent: "#60A5FA", y_pos: 400, category: "dark" },

    // ─── Existing: Nature (auto-registered before) ──────────────────
    "T_096": { id: "T_096", style: "Nature Bloom", file: "T_096.jpg", text_color: "#1A1A1A", accent: "#2563EB", y_pos: 675, category: "nature" },
    "T_097": { id: "T_097", style: "Mountain View", file: "T_097.jpg", text_color: "#FFFFFF", accent: "#60A5FA", y_pos: 675, category: "nature" },
    "T_098": { id: "T_098", style: "Forest Path", file: "T_098.jpg", text_color: "#1A1A1A", accent: "#2563EB", y_pos: 675, category: "nature" },
    "T_099": { id: "T_099", style: "Sunset Field", file: "T_099.jpg", text_color: "#1A1A1A", accent: "#2563EB", y_pos: 675, category: "nature" },
    "T_101": { id: "T_101", style: "Lake Reflection", file: "T_101.jpg", text_color: "#FFFFFF", accent: "#60A5FA", y_pos: 675, category: "nature" },
    "T_102": { id: "T_102", style: "Cloudy Peaks", file: "T_102.jpg", text_color: "#FFFFFF", accent: "#60A5FA", y_pos: 675, category: "nature" },
    "T_108": { id: "T_108", style: "Ocean Breeze", file: "T_108.jpg", text_color: "#FFFFFF", accent: "#60A5FA", y_pos: 675, category: "nature" },
    "T_109": { id: "T_109", style: "Desert Horizon", file: "T_109.jpg", text_color: "#FFFFFF", accent: "#60A5FA", y_pos: 675, category: "nature" },
    "T_114": { id: "T_114", style: "Green Valley", file: "T_114.jpg", text_color: "#1A1A1A", accent: "#2563EB", y_pos: 675, category: "nature" },
    "T_115": { id: "T_115", style: "Rocky Shore", file: "T_115.jpg", text_color: "#FFFFFF", accent: "#60A5FA", y_pos: 675, category: "nature" },
    "T_116": { id: "T_116", style: "Autumn Leaves", file: "T_116.jpg", text_color: "#1A1A1A", accent: "#2563EB", y_pos: 675, category: "nature" },
    "T_117": { id: "T_117", style: "Wildflower Meadow", file: "T_117.jpg", text_color: "#1A1A1A", accent: "#2563EB", y_pos: 675, category: "nature" },
    "T_118": { id: "T_118", style: "Snowy Peaks", file: "T_118.jpg", text_color: "#FFFFFF", accent: "#60A5FA", y_pos: 675, category: "nature" },
    "T_120": { id: "T_120", style: "River Canyon", file: "T_120.jpg", text_color: "#FFFFFF", accent: "#60A5FA", y_pos: 675, category: "nature" },
    "T_128": { id: "T_128", style: "Northern Lights", file: "T_128.jpg", text_color: "#FFFFFF", accent: "#60A5FA", y_pos: 675, category: "nature" },

    // ─── Generated: Gradient Diagonal ───────────────────────────────
    "G_01": { id: "G_01", style: "Indigo Dream", file: "G_01.jpg", text_color: "#FFFFFF", accent: "#E0E7FF", y_pos: 675, category: "gradient" },
    "G_02": { id: "G_02", style: "Pink Blaze", file: "G_02.jpg", text_color: "#FFFFFF", accent: "#FFF1F2", y_pos: 675, category: "gradient" },
    "G_03": { id: "G_03", style: "Cyan Wave", file: "G_03.jpg", text_color: "#1A1A1A", accent: "#0369A1", y_pos: 675, category: "gradient" },
    "G_04": { id: "G_04", style: "Mint Fresh", file: "G_04.jpg", text_color: "#1A1A1A", accent: "#065F46", y_pos: 675, category: "gradient" },
    "G_05": { id: "G_05", style: "Warm Sunset", file: "G_05.jpg", text_color: "#1A1A1A", accent: "#9A3412", y_pos: 675, category: "gradient" },
    "G_06": { id: "G_06", style: "Lavender Mist", file: "G_06.jpg", text_color: "#1A1A1A", accent: "#6D28D9", y_pos: 675, category: "pastel" },
    "G_07": { id: "G_07", style: "Peach Purple", file: "G_07.jpg", text_color: "#1A1A1A", accent: "#7C3AED", y_pos: 675, category: "gradient" },
    "G_08": { id: "G_08", style: "Soft Cloud", file: "G_08.jpg", text_color: "#1A1A1A", accent: "#4338CA", y_pos: 675, category: "pastel" },
    "G_09": { id: "G_09", style: "Fire Glow", file: "G_09.jpg", text_color: "#FFFFFF", accent: "#FEF3C7", y_pos: 675, category: "gradient" },
    "G_10": { id: "G_10", style: "Neon Party", file: "G_10.jpg", text_color: "#FFFFFF", accent: "#F5D0FE", y_pos: 675, category: "gradient" },

    // ─── Generated: Gradient Horizontal ─────────────────────────────
    "G_11": { id: "G_11", style: "Ocean Blue", file: "G_11.jpg", text_color: "#FFFFFF", accent: "#BFDBFE", y_pos: 675, category: "gradient" },
    "G_12": { id: "G_12", style: "Emerald Forest", file: "G_12.jpg", text_color: "#1A1A1A", accent: "#064E3B", y_pos: 675, category: "gradient" },
    "G_13": { id: "G_13", style: "Berry Fusion", file: "G_13.jpg", text_color: "#FFFFFF", accent: "#EDE9FE", y_pos: 675, category: "gradient" },
    "G_14": { id: "G_14", style: "Midnight Sky", file: "G_14.jpg", text_color: "#FFFFFF", accent: "#93C5FD", y_pos: 675, category: "dark" },
    "G_15": { id: "G_15", style: "Rose Water", file: "G_15.jpg", text_color: "#1A1A1A", accent: "#9F1239", y_pos: 675, category: "pastel" },
    "G_16": { id: "G_16", style: "Dusty Purple", file: "G_16.jpg", text_color: "#FFFFFF", accent: "#C4B5FD", y_pos: 675, category: "dark" },
    "G_17": { id: "G_17", style: "Lime Garden", file: "G_17.jpg", text_color: "#1A1A1A", accent: "#065F46", y_pos: 675, category: "gradient" },
    "G_18": { id: "G_18", style: "Calm Sea", file: "G_18.jpg", text_color: "#1A1A1A", accent: "#4338CA", y_pos: 675, category: "gradient" },
    "G_19": { id: "G_19", style: "Golden Sand", file: "G_19.jpg", text_color: "#1A1A1A", accent: "#92400E", y_pos: 675, category: "gradient" },
    "G_20": { id: "G_20", style: "Wine Night", file: "G_20.jpg", text_color: "#FFFFFF", accent: "#FCA5A5", y_pos: 675, category: "dark" },

    // ─── Generated: Gradient Vertical ───────────────────────────────
    "G_21": { id: "G_21", style: "Sky Aqua", file: "G_21.jpg", text_color: "#1A1A1A", accent: "#0E7490", y_pos: 675, category: "gradient" },
    "G_22": { id: "G_22", style: "Plum Velvet", file: "G_22.jpg", text_color: "#FFFFFF", accent: "#F0ABFC", y_pos: 675, category: "dark" },
    "G_23": { id: "G_23", style: "Spring Green", file: "G_23.jpg", text_color: "#1A1A1A", accent: "#166534", y_pos: 675, category: "gradient" },
    "G_24": { id: "G_24", style: "Blazing Orange", file: "G_24.jpg", text_color: "#FFFFFF", accent: "#FEF3C7", y_pos: 675, category: "gradient" },
    "G_25": { id: "G_25", style: "Steel Blue", file: "G_25.jpg", text_color: "#FFFFFF", accent: "#BFDBFE", y_pos: 675, category: "gradient" },
    "G_26": { id: "G_26", style: "Crimson Dusk", file: "G_26.jpg", text_color: "#FFFFFF", accent: "#FECDD3", y_pos: 675, category: "dark" },
    "G_27": { id: "G_27", style: "Tricolor Bold", file: "G_27.jpg", text_color: "#FFFFFF", accent: "#FDE68A", y_pos: 675, category: "gradient" },
    "G_28": { id: "G_28", style: "Electric Violet", file: "G_28.jpg", text_color: "#FFFFFF", accent: "#E9D5FF", y_pos: 675, category: "gradient" },

    // ─── Generated: Radial ──────────────────────────────────────────
    "G_29": { id: "G_29", style: "Warm Peach", file: "G_29.jpg", text_color: "#1A1A1A", accent: "#C2410C", y_pos: 675, category: "pastel" },
    "G_30": { id: "G_30", style: "Baby Blue", file: "G_30.jpg", text_color: "#1A1A1A", accent: "#1D4ED8", y_pos: 675, category: "pastel" },
    "G_31": { id: "G_31", style: "Fresh Lime", file: "G_31.jpg", text_color: "#1A1A1A", accent: "#15803D", y_pos: 675, category: "pastel" },
    "G_32": { id: "G_32", style: "Cotton Candy", file: "G_32.jpg", text_color: "#1A1A1A", accent: "#7C3AED", y_pos: 675, category: "pastel" },
    "G_33": { id: "G_33", style: "Lemon Ice", file: "G_33.jpg", text_color: "#1A1A1A", accent: "#A16207", y_pos: 675, category: "pastel" },
    "G_34": { id: "G_34", style: "Frost Light", file: "G_34.jpg", text_color: "#1A1A1A", accent: "#1E40AF", y_pos: 675, category: "pastel" },
    "G_35": { id: "G_35", style: "Deep Ocean", file: "G_35.jpg", text_color: "#FFFFFF", accent: "#7DD3FC", y_pos: 675, category: "dark" },
    "G_36": { id: "G_36", style: "Sage Mist", file: "G_36.jpg", text_color: "#1A1A1A", accent: "#166534", y_pos: 675, category: "pastel" },

    // ─── Generated: Dark / Dramatic ─────────────────────────────────
    "G_37": { id: "G_37", style: "Dark Galaxy", file: "G_37.jpg", text_color: "#FFFFFF", accent: "#A78BFA", y_pos: 675, category: "dark" },
    "G_38": { id: "G_38", style: "Midnight Blue", file: "G_38.jpg", text_color: "#FFFFFF", accent: "#60A5FA", y_pos: 675, category: "dark" },
    "G_39": { id: "G_39", style: "Charcoal Noir", file: "G_39.jpg", text_color: "#FFFFFF", accent: "#D1D5DB", y_pos: 675, category: "dark" },
    "G_40": { id: "G_40", style: "Slate Dusk", file: "G_40.jpg", text_color: "#FFFFFF", accent: "#C4B5FD", y_pos: 675, category: "dark" },
    "G_41": { id: "G_41", style: "Dark Teal", file: "G_41.jpg", text_color: "#FFFFFF", accent: "#5EEAD4", y_pos: 675, category: "dark" },
    "G_42": { id: "G_42", style: "Deep Crimson", file: "G_42.jpg", text_color: "#FFFFFF", accent: "#FCA5A5", y_pos: 675, category: "dark" },

    // ─── Generated: Pastel / Soft ───────────────────────────────────
    "G_43": { id: "G_43", style: "Pastel Dream", file: "G_43.jpg", text_color: "#1A1A1A", accent: "#DB2777", y_pos: 675, category: "pastel" },
    "G_44": { id: "G_44", style: "Dusty Rose", file: "G_44.jpg", text_color: "#FFFFFF", accent: "#F9A8D4", y_pos: 675, category: "pastel" },
    "G_45": { id: "G_45", style: "Whisper Pink", file: "G_45.jpg", text_color: "#1A1A1A", accent: "#9F1239", y_pos: 675, category: "pastel" },
    "G_46": { id: "G_46", style: "Cream to Red", file: "G_46.jpg", text_color: "#1A1A1A", accent: "#B91C1C", y_pos: 675, category: "gradient" },
    "G_47": { id: "G_47", style: "Tropical", file: "G_47.jpg", text_color: "#1A1A1A", accent: "#B45309", y_pos: 675, category: "gradient" },
};

export function getTemplatesByCategory(category?: string): CarouselTemplate[] {
    const templates = Object.values(CAROUSEL_TEMPLATES);
    if (!category || category === "all") return templates;
    return templates.filter((t) => t.category === category);
}

export function getRandomTemplate(category?: string): CarouselTemplate {
    const templates = getTemplatesByCategory(category);
    return templates[Math.floor(Math.random() * templates.length)];
}
