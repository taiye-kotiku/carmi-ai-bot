// src/app/api/templates/route.ts
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { CAROUSEL_TEMPLATES } from "@/lib/carousel/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const templatesDir = path.join(process.cwd(), "public/carousel-templates");
        if (!fs.existsSync(templatesDir)) {
            return NextResponse.json({ templates: Object.values(CAROUSEL_TEMPLATES) });
        }
        
        const files = fs.readdirSync(templatesDir).filter(f => f.endsWith(".jpg") || f.endsWith(".png"));
        const allTemplates = [...Object.values(CAROUSEL_TEMPLATES)];
        const registeredIds = new Set(Object.keys(CAROUSEL_TEMPLATES));
        
        // Auto-register missing templates
        for (const file of files) {
            const id = file.replace(/\.(jpg|png)$/, "");
            if (registeredIds.has(id)) continue;
            
            // Determine category based on filename patterns
            let category: "tech" | "gradient" | "office" | "abstract" | "dark" | "nature" = "abstract";
            let style = id;
            
            if (id.startsWith("T_")) {
                const num = parseInt(id.replace("T_", ""));
                if (num >= 96 && num <= 144) {
                    category = "nature";
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
            
            allTemplates.push({
                id,
                style,
                file,
                text_color: category === "dark" ? "#FFFFFF" : "#1A1A1A",
                accent: category === "dark" ? "#60A5FA" : "#2563EB",
                y_pos: 675,
                category,
            });
        }
        
        return NextResponse.json({ templates: allTemplates });
    } catch (error) {
        console.error("Error loading templates:", error);
        return NextResponse.json({ templates: Object.values(CAROUSEL_TEMPLATES) }, { status: 200 });
    }
}
