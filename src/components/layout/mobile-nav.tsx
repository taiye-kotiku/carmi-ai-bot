"use client";

import { useState, useEffect, useCallback } from "react";
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
    Settings,
    CreditCard,
    HelpCircle,
    Palette,
} from "lucide-react";

const quickLinks = [
    { name: "לוח בקרה", href: "/dashboard", icon: LayoutDashboard },
    { name: "תמונה", href: "/generate/image", icon: Image },
    { name: "סרטון", href: "/generate/text-to-video", icon: Video },
    { name: "דמות", href: "/generate/character", icon: Sparkles },
    { name: "גלריה", href: "/gallery", icon: FolderOpen },
];

const allLinks = [
    {
        section: "יצירת תוכן",
        items: [
            { name: "יצירת תמונה", href: "/generate/image", icon: Image },
            { name: "יצירת סרטון", href: "/generate/text-to-video", icon: Video },
            { name: "הנפשת תמונה", href: "/generate/image-to-video", icon: Wand2 },
            { name: "המרה לקריקטורה", href: "/generate/cartoonize", icon: Palette },
            { name: "המרת רילז", href: "/generate/reel-converter", icon: Film },
            { name: "חיתוך סרטון", href: "/generate/video-clips", icon: Scissors },
            { name: "יצירת קרוסלה", href: "/generate/carousel", icon: LayoutGrid },
        ],
    },
    {
        section: "דמויות",
        items: [
            { name: "הדמויות שלי", href: "/characters", icon: Users },
            { name: "תמונה עם דמות", href: "/generate/character", icon: Sparkles },
            { name: "סרטון דמות", href: "/generate/character-video", icon: Clapperboard },
        ],
    },
    {
        section: "ספרייה",
        items: [
            { name: "גלריה", href: "/gallery", icon: FolderOpen },
        ],
    },
    {
        section: "הגדרות",
        items: [
            { name: "מנוי וקרדיטים", href: "/credits", icon: CreditCard },
            { name: "הגדרות חשבון", href: "/settings", icon: Settings },
            { name: "עזרה ותמיכה", href: "/help", icon: HelpCircle },
        ],
    },
];

export function MobileNav() {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();

    // Listen for the header burger button event
    const handleToggle = useCallback(() => {
        setIsOpen((prev) => !prev);
    }, []);

    useEffect(() => {
        window.addEventListener("toggle-mobile-menu", handleToggle);
        return () => {
            window.removeEventListener("toggle-mobile-menu", handleToggle);
        };
    }, [handleToggle]);

    // Close menu on route change
    useEffect(() => {
        setIsOpen(false);
    }, [pathname]);

    // Prevent body scroll when menu is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

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

            {/* Backdrop */}
            {isOpen && (
                <div
                    className="lg:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Slide-in Menu */}
            <div
                className={cn(
                    "lg:hidden fixed top-0 right-0 bottom-0 z-50 w-80 max-w-[85vw] bg-white shadow-2xl transform transition-transform duration-300 ease-in-out",
                    isOpen ? "translate-x-0" : "translate-x-full"
                )}
                dir="rtl"
            >
                {/* Menu Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center">
                            <Sparkles className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-lg font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                            AI Studio
                        </span>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                {/* Menu Content */}
                <div className="p-4 overflow-y-auto h-[calc(100vh-64px)] pb-24">
                    {allLinks.map((section) => (
                        <div key={section.section} className="mb-6">
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-3">
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
                                                "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-150",
                                                isActive
                                                    ? "bg-purple-100 text-purple-700 font-medium"
                                                    : "text-gray-600 hover:bg-gray-100 active:bg-gray-200"
                                            )}
                                        >
                                            <link.icon className={cn("h-5 w-5", isActive && "text-purple-600")} />
                                            <span>{link.name}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}