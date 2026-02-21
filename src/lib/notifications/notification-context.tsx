"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────

export type EphemeralNotification = {
    id: string;
    type: "generation";
    generationType: "image" | "video" | "carousel" | "caricature" | "character" | "reel" | "story" | "creative_hub";
    title: string;
    body: string;
    timestamp: number;
    resultUrl?: string;
};

export type PersistentNotification = {
    id: number;
    type: string;
    title: string;
    body: string;
    is_read: boolean;
    metadata: Record<string, any>;
    created_at: string;
};

type NotificationContextType = {
    // Ephemeral (generation) notifications — in memory only
    ephemeralNotifications: EphemeralNotification[];
    addGenerationNotification: (
        generationType: EphemeralNotification["generationType"],
        count?: number,
        resultUrl?: string
    ) => void;
    dismissEphemeral: (id: string) => void;
    clearAllEphemeral: () => void;

    // Persistent notifications — from DB
    persistentNotifications: PersistentNotification[];
    loadPersistentNotifications: () => Promise<void>;
    markAsRead: (id: number) => Promise<void>;
    markAllAsRead: () => Promise<void>;

    // Combined
    unreadCount: number;
    hasNotifications: boolean;
};

const NotificationContext = createContext<NotificationContextType | null>(null);

// ─── Provider ────────────────────────────────────────────────────────

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const supabase = createClient();
    const [ephemeralNotifications, setEphemeralNotifications] = useState<EphemeralNotification[]>([]);
    const [persistentNotifications, setPersistentNotifications] = useState<PersistentNotification[]>([]);
    const loadedRef = useRef(false);

    // Hebrew display names
    const typeNames: Record<EphemeralNotification["generationType"], string> = {
        image: "תמונה",
        video: "סרטון",
        carousel: "קרוסלה",
        caricature: "קריקטורה",
        character: "דמות",
        reel: "רילז",
        story: "סטורי",
        creative_hub: "מרכז יצירתי",
    };

    // ── Ephemeral ──

    const addGenerationNotification = useCallback(
        (
            generationType: EphemeralNotification["generationType"],
            count?: number,
            resultUrl?: string
        ) => {
            const typeName = typeNames[generationType];
            const countText =
                count && count > 1 ? ` (${count})` : "";

            const notification: EphemeralNotification = {
                id: `gen-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                type: "generation",
                generationType,
                title: "היצירה הושלמה! 🎉",
                body: `ה${typeName} שלך מוכן${countText}`,
                timestamp: Date.now(),
                resultUrl,
            };

            setEphemeralNotifications((prev) => [notification, ...prev]);

            // Also fire browser notification if permitted (use stable tag to prevent duplicates)
            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
                const n = new Notification(notification.title, {
                    body: notification.body,
                    icon: "/favicon.ico",
                    tag: `generation-${generationType}`,
                });
                n.onclick = () => {
                    window.focus();
                    n.close();
                };
                setTimeout(() => n.close(), 5000);
            }
        },
        []
    );

    const dismissEphemeral = useCallback((id: string) => {
        setEphemeralNotifications((prev) => prev.filter((n) => n.id !== id));
    }, []);

    const clearAllEphemeral = useCallback(() => {
        setEphemeralNotifications([]);
    }, []);

    // ── Persistent ──

    const loadPersistentNotifications = useCallback(async () => {
        const { data } = await supabase
            .from("notifications")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(50);

        if (data) {
            setPersistentNotifications(data as PersistentNotification[]);
        }
    }, [supabase]);

    const markAsRead = useCallback(
        async (id: number) => {
            await supabase.from("notifications").update({ is_read: true }).eq("id", id);
            setPersistentNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
            );
        },
        [supabase]
    );

    const markAllAsRead = useCallback(async () => {
        const unreadIds = persistentNotifications.filter((n) => !n.is_read).map((n) => n.id);
        if (unreadIds.length === 0) return;

        await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
        setPersistentNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    }, [supabase, persistentNotifications]);

    // ── Load on mount ──

    useEffect(() => {
        if (!loadedRef.current) {
            loadedRef.current = true;
            loadPersistentNotifications();
        }
    }, [loadPersistentNotifications]);

    // ── Computed ──

    const unreadPersistentCount = persistentNotifications.filter((n) => !n.is_read).length;
    const unreadCount = ephemeralNotifications.length + unreadPersistentCount;
    const hasNotifications =
        ephemeralNotifications.length > 0 || persistentNotifications.length > 0;

    return (
        <NotificationContext.Provider
            value={{
                ephemeralNotifications,
                addGenerationNotification,
                dismissEphemeral,
                clearAllEphemeral,
                persistentNotifications,
                loadPersistentNotifications,
                markAsRead,
                markAllAsRead,
                unreadCount,
                hasNotifications,
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const ctx = useContext(NotificationContext);
    if (!ctx) {
        throw new Error("useNotifications must be used within NotificationProvider");
    }
    return ctx;
}