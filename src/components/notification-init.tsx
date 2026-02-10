"use client";

import { useEffect } from "react";
import { initNotifications } from "@/lib/services/notifications";

export function NotificationInit() {
    useEffect(() => {
        initNotifications();
    }, []);

    return null;
}
