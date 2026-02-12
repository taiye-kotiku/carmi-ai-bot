"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, X, Check, CheckCheck, Sparkles, AlertTriangle, CreditCard, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications, type EphemeralNotification, type PersistentNotification } from "@/lib/notifications/notification-context";
import { cn } from "@/lib/utils";

export function NotificationBell() {
    const {
        ephemeralNotifications,
        persistentNotifications,
        unreadCount,
        dismissEphemeral,
        clearAllEphemeral,
        markAsRead,
        markAllAsRead,
    } = useNotifications();

    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const formatTime = (timestamp: number | string) => {
        const date = typeof timestamp === "number" ? new Date(timestamp) : new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMin < 1) return "עכשיו";
        if (diffMin < 60) return `לפני ${diffMin} דק׳`;
        if (diffHours < 24) return `לפני ${diffHours} שע׳`;
        return `לפני ${diffDays} ימים`;
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case "generation":
                return <Sparkles className="h-4 w-4 text-purple-500" />;
            case "storage_warning":
            case "storage_critical":
                return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
            case "auto_delete":
                return <Trash2 className="h-4 w-4 text-red-500" />;
            case "billing":
            case "credits":
                return <CreditCard className="h-4 w-4 text-green-500" />;
            default:
                return <Bell className="h-4 w-4 text-gray-500" />;
        }
    };

    const allNotifications: Array<{
        kind: "ephemeral" | "persistent";
        id: string | number;
        type: string;
        title: string;
        body: string;
        time: number | string;
        isRead: boolean;
    }> = [
        ...ephemeralNotifications.map((n) => ({
            kind: "ephemeral" as const,
            id: n.id,
            type: "generation",
            title: n.title,
            body: n.body,
            time: n.timestamp,
            isRead: false,
        })),
        ...persistentNotifications.map((n) => ({
            kind: "persistent" as const,
            id: n.id,
            type: n.type,
            title: n.title,
            body: n.body,
            time: n.created_at,
            isRead: n.is_read,
        })),
    ].sort((a, b) => {
        const timeA = typeof a.time === "number" ? a.time : new Date(a.time).getTime();
        const timeB = typeof b.time === "number" ? b.time : new Date(b.time).getTime();
        return timeB - timeA;
    });

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(!isOpen)}
                className="relative"
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </Button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute left-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                        <h3 className="font-semibold text-sm text-gray-700">התראות</h3>
                        <div className="flex items-center gap-1">
                            {unreadCount > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs text-purple-600 hover:text-purple-700 h-7 px-2"
                                    onClick={() => {
                                        clearAllEphemeral();
                                        markAllAsRead();
                                    }}
                                >
                                    <CheckCheck className="h-3.5 w-3.5 ml-1" />
                                    סמן הכל כנקרא
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Notification List */}
                    <div className="max-h-96 overflow-y-auto">
                        {allNotifications.length === 0 ? (
                            <div className="p-8 text-center">
                                <Bell className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                <p className="text-sm text-gray-400">אין התראות חדשות</p>
                            </div>
                        ) : (
                            allNotifications.map((notification) => (
                                <div
                                    key={`${notification.kind}-${notification.id}`}
                                    className={cn(
                                        "flex items-start gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors",
                                        !notification.isRead && "bg-purple-50/50"
                                    )}
                                >
                                    {/* Icon */}
                                    <div className="mt-0.5 h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                        {getNotificationIcon(notification.type)}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{notification.body}</p>
                                        <p className="text-[10px] text-gray-400 mt-1">
                                            {formatTime(notification.time)}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <button
                                        className="mt-0.5 text-gray-400 hover:text-gray-600 flex-shrink-0"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (notification.kind === "ephemeral") {
                                                dismissEphemeral(notification.id as string);
                                            } else {
                                                markAsRead(notification.id as number);
                                            }
                                        }}
                                    >
                                        {notification.kind === "ephemeral" ? (
                                            <X className="h-4 w-4" />
                                        ) : !notification.isRead ? (
                                            <Check className="h-4 w-4" />
                                        ) : null}
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}