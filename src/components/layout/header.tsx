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
        // Dispatch a custom event that MobileNav listens for
        window.dispatchEvent(new CustomEvent("toggle-mobile-menu"));
    };

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white px-6">
            {/* Mobile menu button - 44px touch target */}
            <Button
                variant="ghost"
                size="icon"
                className="lg:hidden min-h-[44px] min-w-[44px]"
                onClick={openMobileMenu}
            >
                <Menu className="h-5 w-5" />
            </Button>

            {/* Credits - compact on mobile, full on desktop */}
            <div className="flex items-center gap-4 text-sm">
                <Link
                    href="/credits"
                    className="flex items-center gap-2 px-3 py-2 rounded-full bg-purple-50 hover:bg-purple-100 transition-colors min-h-[44px] md:min-h-0 md:py-1.5"
                >
                    <Coins className="h-4 w-4 text-purple-600 flex-shrink-0" />
                    <span className="text-gray-600">
                        <span className="hidden sm:inline">קרדיטים: </span>
                        <strong className="text-purple-700">{totalCredits}</strong>
                    </span>
                </Link>
            </div>

            {/* User section */}
            <div className="flex items-center gap-4">
                <NotificationBell />

                <Link href="/settings" className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
                        {profile?.name?.charAt(0) || profile?.email?.charAt(0) || "U"}
                    </div>
                    <span className="text-sm font-medium hidden md:block">
                        {profile?.name || "משתמש"}
                    </span>
                </Link>
            </div>
        </header>
    );
}