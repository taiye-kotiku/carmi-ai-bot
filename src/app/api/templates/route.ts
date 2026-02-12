// src/app/api/templates/route.ts
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { CAROUSEL_TEMPLATES } from "@/lib/carousel/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    // Add cache headers to prevent caching
    const headers = new Headers();
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");
    try {
        const templatesDir = path.join(process.cwd(), "public/carousel-templates");
        if (!fs.existsSync(templatesDir)) {
            return NextResponse.json({ templates: Object.values(CAROUSEL_TEMPLATES) });
        }
        
        const files = fs.readdirSync(templatesDir).filter(f => f.endsWith(".jpg") || f.endsWith(".png"));
        const allTemplates: typeof CAROUSEL_TEMPLATES[string][] = [];
        const registeredIds = new Set(Object.keys(CAROUSEL_TEMPLATES));
        const processedIds = new Set<string>();
        
        // First add registered templates
        for (const template of Object.values(CAROUSEL_TEMPLATES)) {
            allTemplates.push(template);
            processedIds.add(template.id);
        }
        
        // Auto-register missing templates
        for (const file of files) {
            const id = file.replace(/\.(jpg|png)$/, "");
            if (processedIds.has(id)) continue;
            
            // Determine category based on filename patterns
            let category: "tech" | "gradient" | "office" | "abstract" | "dark" | "nature" | "pastel" = "abstract";
            let style = id;
            
            if (id.startsWith("G_")) {
                const num = parseInt(id.replace("G_", ""));
                if (!isNaN(num)) {
                    if (num >= 37 && num <= 42) {
                        category = "dark";
                        style = `Dark Gradient ${num}`;
                    } else if (num >= 29 && num <= 36 || num >= 43) {
                        category = "pastel";
                        style = `Pastel ${num}`;
                    } else {
                        category = "gradient";
                        style = `Gradient ${num}`;
                    }
                }
            } else if (id.startsWith("T_")) {
                const num = parseInt(id.replace("T_", ""));
                if (!isNaN(num)) {
                    if (num >= 96 && num <= 144) {
                        category = "nature";
                        style = `Nature ${num - 95}`;
                    } else if (num >= 20 && num <= 30) {
                        category = "gradient";
                        style = `Gradient ${num}`;
                    } else if (num >= 60 && num <= 80) {
                        category = "tech";
                        style = `Tech ${num}`;
                    } else if (num >= 6 && num <= 18) {
                        category = "dark";
                        style = `Dark ${num}`;
                    } else {
                        category = "abstract";
                        style = `Abstract ${num}`;
                    }
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
            processedIds.add(id);
        }
        
        console.log(`Loaded ${allTemplates.length} templates (${Object.keys(CAROUSEL_TEMPLATES).length} registered + ${allTemplates.length - Object.keys(CAROUSEL_TEMPLATES).length} auto-registered)`);
        console.log(`Total files found: ${files.length}`);
        
        // Sort templates by ID for consistent ordering
        allTemplates.sort((a, b) => {
            // Sort b templates first, then T_ templates numerically
            if (a.id.startsWith("b") && b.id.startsWith("T_")) return -1;
            if (a.id.startsWith("T_") && b.id.startsWith("b")) return 1;
            if (a.id.startsWith("T_") && b.id.startsWith("T_")) {
                const numA = parseInt(a.id.replace("T_", "")) || 0;
                const numB = parseInt(b.id.replace("T_", "")) || 0;
                return numA - numB;
            }
            return a.id.localeCompare(b.id);
        });
        
        const response = NextResponse.json({ 
            templates: allTemplates,
            count: allTemplates.length,
            registered: Object.keys(CAROUSEL_TEMPLATES).length,
            autoRegistered: allTemplates.length - Object.keys(CAROUSEL_TEMPLATES).length,
            filesFound: files.length
        });
        
        // Set no-cache headers
        response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        response.headers.set("Pragma", "no-cache");
        response.headers.set("Expires", "0");
        
        return response;
    } catch (error) {
        console.error("Error loading templates:", error);
        const fallback = NextResponse.json({ templates: Object.values(CAROUSEL_TEMPLATES) }, { status: 200 });
        fallback.headers.set("Cache-Control", "no-store");
        return fallback;
    }
}
