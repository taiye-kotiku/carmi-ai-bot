"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
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

type NavItem =
    | { type: "divider"; label: string }
    | {
        type: "link";
        name: string;
        href: string;
        icon: React.ComponentType<{ className?: string }>;
        badge?: string;
    };

const navigation: NavItem[] = [
    { type: "link", name: "לוח בקרה", href: "/dashboard", icon: LayoutDashboard },

    { type: "divider", label: "יצירת תוכן" },
    { type: "link", name: "יצירת תמונה", href: "/generate/text-to-image", icon: Image },
    { type: "link", name: "יצירת סרטון", href: "/generate/text-to-video", icon: Video },
    { type: "link", name: "הנפשת תמונה", href: "/generate/image-to-video", icon: Wand2 },
    { type: "link", name: "המרה לקריקטורה", href: "/generate/cartoonize", icon: Palette },
    { type: "link", name: "המרת רילז", href: "/generate/reel-converter", icon: Film },
    { type: "link", name: "חיתוך סרטון", href: "/generate/video-clips", icon: Scissors },
    { type: "link", name: "יצירת קרוסלה", href: "/generate/carousel", icon: LayoutGrid },

    { type: "divider", label: "דמויות" },
    { type: "link", name: "הדמויות שלי", href: "/characters", icon: Users },
    { type: "link", name: "תמונה עם דמות", href: "/generate/character", icon: Sparkles },
    { type: "link", name: "סרטון דמות", href: "/generate/character-video", icon: Clapperboard, badge: "חדש" },

    { type: "divider", label: "ספרייה" },
    { type: "link", name: "גלריה", href: "/gallery", icon: FolderOpen },

    { type: "divider", label: "הגדרות" },
    { type: "link", name: "מנוי וקרדיטים", href: "/credits", icon: CreditCard },
    { type: "link", name: "הגדרות חשבון", href: "/settings", icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside
            className="hidden lg:flex lg:flex-col fixed right-0 top-0 w-64 bg-white border-l border-gray-200 h-screen"
            dir="rtl"
        >
            {/* Logo */}
            <div className="p-6 border-b border-gray-100">
                <Link href="/dashboard" className="flex items-center gap-2">
                    <div className="h-9 w-9 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center">
                        <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                        AI Studio
                    </span>
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                {navigation.map((item, index) => {
                    if (item.type === "divider") {
                        return (
                            <div key={`divider-${index}`} className="pt-5 pb-2">
                                <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    {item.label}
                                </p>
                            </div>
                        );
                    }

                    const isActive =
                        pathname === item.href ||
                        (item.href !== "/dashboard" && pathname.startsWith(item.href));

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                                isActive
                                    ? "bg-purple-100 text-purple-700 font-medium"
                                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <item.icon
                                    className={cn("h-5 w-5", isActive && "text-purple-600")}
                                />
                                <span>{item.name}</span>
                            </div>
                            {item.badge && (
                                <span className="px-2 py-0.5 text-[10px] font-bold bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-full">
                                    {item.badge}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Bottom Section */}
            <div className="p-4 border-t border-gray-100 space-y-3">
                <Link
                    href="/help"
                    className="flex items-center gap-3 px-3 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                    <HelpCircle className="h-5 w-5" />
                    <span className="text-sm">עזרה ותמיכה</span>
                </Link>

                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-100">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="h-6 w-6 bg-purple-100 rounded-lg flex items-center justify-center">
                            <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                        </div>
                        <span className="text-sm font-semibold text-purple-700">
                            טיפ מקצועי
                        </span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">
                        צור דמות ושמור על עקביות מושלמת בכל התמונות והסרטונים שלך!
                    </p>
                    <Link
                        href="/characters"
                        className="mt-3 text-xs font-medium text-purple-600 hover:text-purple-700 flex items-center gap-1"
                    >
                        צור דמות ראשונה
                        <span className="text-lg leading-none">←</span>
                    </Link>
                </div>
            </div>
        </aside>
    );
}