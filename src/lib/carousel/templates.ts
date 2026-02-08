// src/lib/carousel/templates.ts
import fs from "fs";
import path from "path";

export interface CarouselTemplate {
    id: string;
    style: string;
    file: string;
    text_color: string;
    accent: string;
    y_pos: number;
    category: "tech" | "gradient" | "office" | "abstract" | "dark" | "nature";
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
    "b1": { id: "b1", style: "בניין 1", file: "b1.jpg", text_color: "#FFFFFF", accent: "#F8FF00", y_pos: 400, category: "abstract" },
    "b2": { id: "b2", style: "בניין 2", file: "b2.jpg", text_color: "#FFFFFF", accent: "#F8FF00", y_pos: 400, category: "abstract" },
    "b3": { id: "b3", style: "בניין 3", file: "b3.jpg", text_color: "#FFFFFF", accent: "#F8FF00", y_pos: 400, category: "abstract" },
    "b4": { id: "b4", style: "בניין 4", file: "b4.jpg", text_color: "#FFFFFF", accent: "#F8FF00", y_pos: 400, category: "abstract" },
    "b5": { id: "b5", style: "בניין 5", file: "b5.jpg", text_color: "#FFFFFF", accent: "#F8FF00", y_pos: 400, category: "abstract" },
    "b6": { id: "b6", style: "בניין 6", file: "b6.jpg", text_color: "#FFFFFF", accent: "#F8FF00", y_pos: 400, category: "abstract" },
};

// Auto-register templates from folder that aren't in CAROUSEL_TEMPLATES
function getAutoRegisteredTemplates(): CarouselTemplate[] {
    const templatesDir = path.join(process.cwd(), "public/carousel-templates");
    if (!fs.existsSync(templatesDir)) return [];
    
    const files = fs.readdirSync(templatesDir).filter(f => f.endsWith(".jpg") || f.endsWith(".png"));
    const autoTemplates: CarouselTemplate[] = [];
    
    for (const file of files) {
        const id = file.replace(/\.(jpg|png)$/, "");
        // Skip if already registered
        if (CAROUSEL_TEMPLATES[id]) continue;
        
        // Determine category based on filename patterns
        let category: CarouselTemplate["category"] = "abstract";
        let style = id;
        
        if (id.startsWith("T_")) {
            const num = parseInt(id.replace("T_", ""));
            if (num >= 96 && num <= 144) {
                category = "nature"; // Nature backgrounds we downloaded
                style = `Nature ${num - 95}`;
            } else if (num >= 20 && num <= 30) {
                category = "gradient";
                style = `Gradient ${num}`;
            } else if (num >= 60 && num <= 80) {
                category = "tech";
                style = `Tech ${num}`;
            } else {
                category = "abstract";
                style = `Abstract ${num}`;
            }
        } else if (id.startsWith("b")) {
            category = "abstract";
            style = `Building ${id.replace("b", "")}`;
        }
        
        autoTemplates.push({
            id,
            style,
            file,
            text_color: category === "dark" ? "#FFFFFF" : "#1A1A1A",
            accent: category === "dark" ? "#60A5FA" : "#2563EB",
            y_pos: 675,
            category,
        });
    }
    
    return autoTemplates;
}

// Merge registered and auto-registered templates
function getAllTemplates(): CarouselTemplate[] {
    const registered = Object.values(CAROUSEL_TEMPLATES);
    const autoRegistered = getAutoRegisteredTemplates();
    return [...registered, ...autoRegistered];
}

export function getTemplatesByCategory(category?: string): CarouselTemplate[] {
    const templates = getAllTemplates();
    if (!category || category === "all") return templates;
    return templates.filter((t) => t.category === category);
}

export function getRandomTemplate(category?: string): CarouselTemplate {
    const templates = getTemplatesByCategory(category);
    return templates[Math.floor(Math.random() * templates.length)];
}