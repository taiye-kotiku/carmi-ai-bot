// src/components/layout/mobile-nav.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    Menu,
    X,
    LayoutDashboard,
    Image,
    Video,
    Film,
    Wand2,
    FolderOpen,
    Scissors,
    Users,
    Sparkles,
    LayoutGrid,
    Clapperboard,
} from "lucide-react";

const quickLinks = [
    { name: "לוח בקרה", href: "/dashboard", icon: LayoutDashboard },
    { name: "תמונה", href: "/generate/text-to-image", icon: Image },
    { name: "סרטון", href: "/generate/text-to-video", icon: Video },
    { name: "דמות", href: "/generate/character", icon: Sparkles },
    { name: "גלריה", href: "/gallery", icon: FolderOpen },
];

const allLinks = [
    {
        section: "יצירת תוכן", items: [
            { name: "יצירת תמונה", href: "/generate/text-to-image", icon: Image },
            { name: "יצירת סרטון", href: "/generate/text-to-video", icon: Video },
            { name: "הנפשת תמונה", href: "/generate/image-to-video", icon: Wand2 },
            { name: "המרת ריל", href: "/generate/reel-converter", icon: Film },
            { name: "חיתוך סרטון", href: "/generate/video-clips", icon: Scissors },
            { name: "יצירת קרוסלה", href: "/generate/carousel", icon: LayoutGrid },
        ]
    },
    {
        section: "דמויות", items: [
            { name: "הדמויות שלי", href: "/characters", icon: Users },
            { name: "תמונה עם דמות", href: "/generate/character", icon: Sparkles },
            { name: "סרטון דמות", href: "/generate/character-video", icon: Clapperboard },
        ]
    },
    {
        section: "ספרייה", items: [
            { name: "גלריה", href: "/gallery", icon: FolderOpen },
        ]
    },
];

export function MobileNav() {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();

    return (
        <>
            {/* Bottom Tab Bar */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40" dir="rtl">
                <div className="flex justify-around items-center h-16">
                    {quickLinks.map((link) => {
                        const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={cn(
                                    "flex flex-col items-center gap-1 px-3 py-2",
                                    isActive ? "text-purple-600" : "text-gray-500"
                                )}
                            >
                                <link.icon className="h-5 w-5" />
                                <span className="text-[10px]">{link.name}</span>
                            </Link>
                        );
                    })}
                    <button
                        onClick={() => setIsOpen(true)}
                        className="flex flex-col items-center gap-1 px-3 py-2 text-gray-500"
                    >
                        <Menu className="h-5 w-5" />
                        <span className="text-[10px]">עוד</span>
                    </button>
                </div>
            </nav>

            {/* Full Menu Overlay */}
            {isOpen && (
                <div className="lg:hidden fixed inset-0 z-50 bg-white" dir="rtl">
                    <div className="flex items-center justify-between p-4 border-b">
                        <span className="text-lg font-bold">תפריט</span>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-2 hover:bg-gray-100 rounded-lg"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>
                    <div className="p-4 overflow-y-auto h-[calc(100vh-64px)]">
                        {allLinks.map((section) => (
                            <div key={section.section} className="mb-6">
                                <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
                                    {section.section}
                                </h3>
                                <div className="space-y-1">
                                    {section.items.map((link) => {
                                        const isActive = pathname === link.href;
                                        return (
                                            <Link
                                                key={link.href}
                                                href={link.href}
                                                onClick={() => setIsOpen(false)}
                                                className={cn(
                                                    "flex items-center gap-3 px-3 py-3 rounded-lg",
                                                    isActive
                                                        ? "bg-purple-100 text-purple-700"
                                                        : "text-gray-600 hover:bg-gray-100"
                                                )}
                                            >
                                                <link.icon className="h-5 w-5" />
                                                <span>{link.name}</span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}