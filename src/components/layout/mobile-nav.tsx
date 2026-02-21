"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
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
    Pencil,
    ChevronLeft,
} from "lucide-react";

const quickLinks = [
    { name: "בית", href: "/dashboard", icon: LayoutDashboard },
    { name: "יצירה", href: "/generate/creative-hub", icon: Sparkles },
    { name: "תמונה", href: "/generate/image", icon: Image },
    { name: "סרטון", href: "/generate/text-to-video", icon: Video },
    { name: "גלריה", href: "/gallery", icon: FolderOpen },
];

const allLinks = [
    {
        section: "יצירת תוכן",
        items: [
            { name: "מרכז יצירתי", href: "/generate/creative-hub", icon: Sparkles, badge: "חדש" },
            { name: "יצירת תמונה", href: "/generate/image", icon: Image },
            { name: "עריכת תמונה", href: "/generate/image-editing", icon: Pencil },
            { name: "יצירת סרטון", href: "/generate/text-to-video", icon: Video },
            { name: "הנפשת תמונה", href: "/generate/image-to-video", icon: Wand2 },
            { name: "יצירת קריקטורה", href: "/generate/cartoonize", icon: Palette },
            { name: "וידאו לתמונות", href: "/generate/video-to-images", icon: Film },
            { name: "רילז מוידאו", href: "/generate/video-clips", icon: Scissors },
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

    const handleToggle = useCallback(() => {
        setIsOpen((prev) => !prev);
    }, []);

    useEffect(() => {
        window.addEventListener("toggle-mobile-menu", handleToggle);
        return () => {
            window.removeEventListener("toggle-mobile-menu", handleToggle);
        };
    }, [handleToggle]);

    useEffect(() => {
        setIsOpen(false);
    }, [pathname]);

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
            {/* Bottom Tab Bar - safe area aware */}
            <nav
                className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200/80 z-40 pb-[env(safe-area-inset-bottom)]"
                dir="rtl"
            >
                <div className="flex justify-around items-center h-14">
                    {quickLinks.map((link) => {
                        const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={cn(
                                    "flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] px-1 transition-colors duration-150",
                                    isActive ? "text-purple-600" : "text-gray-400"
                                )}
                            >
                                <link.icon className={cn("h-5 w-5", isActive && "stroke-[2.5px]")} />
                                <span className="text-[10px] leading-tight font-medium">{link.name}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>

            {/* Backdrop */}
            <div
                className={cn(
                    "lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300",
                    isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                )}
                onClick={() => setIsOpen(false)}
            />

            {/* Slide-in Menu */}
            <div
                className={cn(
                    "lg:hidden fixed top-0 right-0 bottom-0 z-50 w-[80vw] max-w-[320px] bg-white shadow-2xl transform transition-transform duration-300 ease-out will-change-transform",
                    isOpen ? "translate-x-0" : "translate-x-full"
                )}
                dir="rtl"
            >
                {/* Menu Header */}
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
                            <Sparkles className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-lg font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                            kossem
                        </span>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-150 min-h-[44px] min-w-[44px] flex items-center justify-center"
                        aria-label="סגור תפריט"
                    >
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                {/* Menu Content */}
                <div className="overflow-y-auto h-[calc(100dvh-60px)] overscroll-contain pb-20">
                    {allLinks.map((section) => (
                        <div key={section.section} className="px-3 pt-4">
                            <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-3">
                                {section.section}
                            </h3>
                            <div className="space-y-0.5">
                                {section.items.map((link) => {
                                    const isActive = pathname === link.href;
                                    return (
                                        <Link
                                            key={link.href}
                                            href={link.href}
                                            onClick={() => setIsOpen(false)}
                                            className={cn(
                                                "flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-150 min-h-[44px] cursor-pointer",
                                                isActive
                                                    ? "bg-purple-50 text-purple-700 font-medium"
                                                    : "text-gray-600 hover:bg-gray-50 active:bg-gray-100"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <link.icon className={cn("h-[18px] w-[18px] flex-shrink-0", isActive ? "text-purple-600" : "text-gray-400")} />
                                                <span className="text-sm">{link.name}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                {"badge" in link && link.badge && (
                                                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-full leading-tight">
                                                        {link.badge}
                                                    </span>
                                                )}
                                                <ChevronLeft className="h-4 w-4 text-gray-300" />
                                            </div>
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
