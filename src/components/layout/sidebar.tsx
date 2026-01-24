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
    CreditCard,
    Settings,
    Scissors
} from "lucide-react";

const navigation = [
    { name: "לוח בקרה", href: "/dashboard", icon: LayoutDashboard },
    { name: "יצירת תמונה", href: "/generate/text-to-image", icon: Image },
    { name: "יצירת סרטון", href: "/generate/text-to-video", icon: Video },
    { name: "הנפשת תמונה", href: "/generate/image-to-video", icon: Wand2 },
    { name: "המרת ריל", href: "/generate/reel-converter", icon: Film },
    { name: "גלריה", href: "/gallery", icon: FolderOpen },
    { name: "חיתוך סרטון", href: "/generate/video-clips", icon: Scissors },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-64 bg-white border-l border-gray-200 min-h-screen p-4" dir="rtl">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-purple-600">AI Studio</h1>
            </div>

            <nav className="space-y-2">
                {navigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                                isActive
                                    ? "bg-purple-100 text-purple-700"
                                    : "text-gray-600 hover:bg-gray-100"
                            )}
                        >
                            <item.icon className="h-5 w-5" />
                            <span>{item.name}</span>
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
}