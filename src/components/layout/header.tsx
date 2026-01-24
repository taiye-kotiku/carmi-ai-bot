"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Bell, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Profile, Credits } from "@/types/database";

export function Header() {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [credits, setCredits] = useState<Credits | null>(null);
    const supabase = createClient();

    useEffect(() => {
        async function loadUser() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profileData } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("id", user.id)
                    .single();

                const { data: creditsData } = await supabase
                    .from("credits")
                    .select("*")
                    .eq("user_id", user.id)
                    .single();

                setProfile(profileData);
                setCredits(creditsData);
            }
        }
        loadUser();
    }, [supabase]);

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white px-6">
            {/* Mobile menu button */}
            <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
            </Button>

            {/* Credits summary (desktop) */}
            <div className="hidden md:flex items-center gap-4 text-sm">
                {credits && (
                    <>
                        <span className="text-gray-500">
                            תמונות: <strong className="text-gray-900">{credits.image_credits}</strong>
                        </span>
                        <span className="text-gray-500">
                            ריילים: <strong className="text-gray-900">{credits.reel_credits}</strong>
                        </span>
                    </>
                )}
            </div>

            {/* User section */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon">
                    <Bell className="h-5 w-5" />
                </Button>

                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
                        {profile?.name?.charAt(0) || profile?.email?.charAt(0) || "U"}
                    </div>
                    <span className="text-sm font-medium hidden md:block">
                        {profile?.name || "משתמש"}
                    </span>
                </div>
            </div>
        </header>
    );
}