"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Menu, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { Tables } from "@/types/database";
import { NotificationBell } from "@/components/layout/notification-bell";

type Profile = Tables<"profiles">;

export function Header() {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [totalCredits, setTotalCredits] = useState<number>(0);
    const supabase = createClient();

    useEffect(() => {
        async function loadUser() {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (user) {
                const { data: profileData } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("id", user.id)
                    .single();

                const { data: creditsData } = await supabase
                    .from("credits")
                    .select("credits")
                    .eq("user_id", user.id)
                    .single();

                setProfile(profileData);
                setTotalCredits(creditsData?.credits ?? 0);
            }
        }
        loadUser();
    }, [supabase]);

    const openMobileMenu = () => {
        window.dispatchEvent(new CustomEvent("toggle-mobile-menu"));
    };

    return (
        <header className="sticky top-0 z-30 flex h-14 sm:h-16 items-center justify-between border-b border-gray-200/80 bg-white/80 backdrop-blur-md px-4 sm:px-6">
            <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={openMobileMenu}
                aria-label="פתח תפריט"
            >
                <Menu className="h-5 w-5" />
            </Button>

            <div className="flex items-center gap-2 sm:gap-4 text-sm">
                <Link
                    href="/credits"
                    className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full bg-purple-50 hover:bg-purple-100 transition-colors duration-200 cursor-pointer"
                >
                    <Coins className="h-4 w-4 text-purple-600 flex-shrink-0" />
                    <span className="text-gray-700 text-xs sm:text-sm">
                        <span className="hidden sm:inline">קרדיטים: </span>
                        <strong className="text-purple-700">{totalCredits}</strong>
                    </span>
                </Link>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
                <NotificationBell />
                <Link href="/settings" className="flex items-center gap-2 cursor-pointer">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold shadow-sm">
                        {profile?.name?.charAt(0) || profile?.email?.charAt(0) || "U"}
                    </div>
                    <span className="text-sm font-medium text-gray-700 hidden md:block">
                        {profile?.name || "משתמש"}
                    </span>
                </Link>
            </div>
        </header>
    );
}
