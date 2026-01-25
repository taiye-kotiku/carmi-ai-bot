// src/lib/carousel/templates.ts
export interface CarouselTemplate {
    id: string;
    style: string;
    file: string;
    text_color: string;
    accent: string;
    y_pos: number;
    category: "tech" | "gradient" | "office" | "abstract" | "dark";
}

export const CAROUSEL_TEMPLATES: Record<string, CarouselTemplate> = {
    "T_02": {
        id: "T_02",
        style: "Abstract Purple",
        file: "T_02.jpg",
        text_color: "#1A1A1A",
        accent: "#2563EB",
        y_pos: 400,
        category: "gradient"
    },
    "T_04": {
        id: "T_04",
        style: "Smooth Gradient",
        file: "T_04.jpg",
        text_color: "#1A1A1A",
        accent: "#2563EB",
        y_pos: 675,
        category: "gradient"
    },
    "T_06": {
        id: "T_06",
        style: "Cyber Grid",
        file: "T_06.jpg",
        text_color: "#FFFFFF",
        accent: "#60A5FA",
        y_pos: 400,
        category: "dark"
    },
    "T_07": {
        id: "T_07",
        style: "Global Data",
        file: "T_07.jpg",
        text_color: "#FFFFFF",
        accent: "#60A5FA",
        y_pos: 400,
        category: "dark"
    },
    "T_10": {
        id: "T_10",
        style: "Hardware Close-up",
        file: "T_10.jpg",
        text_color: "#1A1A1A",
        accent: "#2563EB",
        y_pos: 400,
        category: "tech"
    },
    "T_11": {
        id: "T_11",
        style: "Modern Office",
        file: "T_11.jpg",
        text_color: "#1A1A1A",
        accent: "#2563EB",
        y_pos: 400,
        category: "office"
    },
    "T_12": {
        id: "T_12",
        style: "Skyscraper Lines",
        file: "T_12.jpg",
        text_color: "#1A1A1A",
        accent: "#2563EB",
        y_pos: 400,
        category: "office"
    },
    "T_13": {
        id: "T_13",
        style: "Red Gradient",
        file: "T_13.jpg",
        text_color: "#1A1A1A",
        accent: "#2563EB",
        y_pos: 675,
        category: "gradient"
    },
    "T_18": {
        id: "T_18",
        style: "Circuit Board",
        file: "T_18.jpg",
        text_color: "#FFFFFF",
        accent: "#60A5FA",
        y_pos: 400,
        category: "tech"
    },
    "T_20": {
        id: "T_20",
        style: "Vibrant Mesh",
        file: "T_20.jpg",
        text_color: "#1A1A1A",
        accent: "#2563EB",
        y_pos: 400,
        category: "gradient"
    },
    "T_21": {
        id: "T_21",
        style: "Dark Landscape",
        file: "T_21.jpg",
        text_color: "#FFFFFF",
        accent: "#60A5FA",
        y_pos: 400,
        category: "dark"
    },
    "T_24": {
        id: "T_24",
        style: "Matrix Green",
        file: "T_24.jpg",
        text_color: "#FFFFFF",
        accent: "#60A5FA",
        y_pos: 400,
        category: "dark"
    },
    "T_27": {
        id: "T_27",
        style: "Deep Space Network",
        file: "T_27.jpg",
        text_color: "#FFFFFF",
        accent: "#60A5FA",
        y_pos: 400,
        category: "dark"
    },
    "T_35": {
        id: "T_35",
        style: "Data Server Glow",
        file: "T_35.jpg",
        text_color: "#1A1A1A",
        accent: "#2563EB",
        y_pos: 400,
        category: "tech"
    },
    "T_65": {
        id: "T_65",
        style: "Smooth Peach Mesh",
        file: "T_65.jpg",
        text_color: "#1A1A1A",
        accent: "#2563EB",
        y_pos: 400,
        category: "gradient"
    },
    "T_74": {
        id: "T_74",
        style: "Workspace Dark Mood",
        file: "T_74.jpg",
        text_color: "#FFFFFF",
        accent: "#60A5FA",
        y_pos: 400,
        category: "dark"
    },
    "T_84": {
        id: "T_84",
        style: "Pastel Soft Gradient",
        file: "T_84.jpg",
        text_color: "#1A1A1A",
        accent: "#2563EB",
        y_pos: 675,
        category: "gradient"
    },
    "T_85": {
        id: "T_85",
        style: "Purple Mesh Vibe",
        file: "T_85.jpg",
        text_color: "#1A1A1A",
        accent: "#2563EB",
        y_pos: 400,
        category: "gradient"
    },
    "T_93": {
        id: "T_93",
        style: "Tech Lobby Clean",
        file: "T_93.jpg",
        text_color: "#1A1A1A",
        accent: "#2563EB",
        y_pos: 400,
        category: "office"
    },
    "T_95": {
        id: "T_95",
        style: "Color Explosion Mesh",
        file: "T_95.jpg",
        text_color: "#1A1A1A",
        accent: "#2563EB",
        y_pos: 400,
        category: "gradient"
    },
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