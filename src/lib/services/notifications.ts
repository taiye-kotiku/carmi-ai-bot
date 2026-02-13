// src/lib/services/notifications.ts
// Push notification service for generation completion

/**
 * Check if notifications are supported
 */
function isNotificationSupported(): boolean {
    if (typeof window === "undefined") return false;
    if (!("Notification" in window)) return false;
    return true;
}

/**
 * Check if we're on mobile
 */
function isMobile(): boolean {
    if (typeof navigator === "undefined") return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
    );
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<boolean> {
    if (!isNotificationSupported()) {
        console.log("This browser does not support notifications");
        return false;
    }

    if (Notification.permission === "granted") {
        return true;
    }

    if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        return permission === "granted";
    }

    return false;
}

/**
 * Show a notification - handles both desktop and mobile
 */
export function showNotification(
    title: string,
    options?: NotificationOptions
): void {
    if (!isNotificationSupported() || Notification.permission !== "granted") {
        return;
    }

    const notificationOptions: NotificationOptions = {
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        ...options,
    };

    // On mobile, use Service Worker notifications
    if (isMobile() || "serviceWorker" in navigator) {
        try {
            navigator.serviceWorker?.ready
                .then((registration) => {
                    registration.showNotification(title, notificationOptions);
                })
                .catch(() => {
                    // Service Worker not available, try fallback
                    tryDesktopNotification(title, notificationOptions);
                });
        } catch {
            // Silent fail on mobile if SW not available
            console.log("Service Worker notification not available");
        }
    } else {
        tryDesktopNotification(title, notificationOptions);
    }
}

/**
 * Desktop notification fallback
 */
function tryDesktopNotification(
    title: string,
    options: NotificationOptions
): void {
    try {
        const notification = new Notification(title, options);

        notification.onclick = () => {
            window.focus();
            notification.close();
        };

        setTimeout(() => {
            notification.close();
        }, 5000);
    } catch (error) {
        // Notification constructor failed (mobile browser)
        console.log("Desktop notification not supported:", error);
    }
}

/**
 * Show notification for completed generation
 */
export function notifyGenerationComplete(
    type: "image" | "video" | "carousel" | "caricature" | "character",
    count?: number
): void {
    const typeNames: Record<typeof type, string> = {
        image: "תמונה",
        video: "סרטון",
        carousel: "קרוסלה",
        caricature: "קריקטורה",
        character: "דמות",
    };

    const typeName = typeNames[type];
    const countText =
        count && count > 1
            ? ` (${count} ${typeName === "תמונה" ? "תמונות" : typeName})`
            : "";

    showNotification("היצירה הושלמה! 🎉", {
        body: `ה${typeName} שלך מוכן${countText}`,
        tag: `generation-${Date.now()}`,
    });
}

/**
 * Initialize notifications on page load
 */
export function initNotifications(): void {
    if (typeof window === "undefined") return;
    if (!isNotificationSupported()) return;

    // Only request permission after user interaction
    const handleUserInteraction = () => {
        requestNotificationPermission().then((granted) => {
            if (granted) {
                console.log("Notification permission granted");
            }
        });
        document.removeEventListener("click", handleUserInteraction);
        document.removeEventListener("touchstart", handleUserInteraction);
    };

    // If already granted, don't add listeners
    if (Notification.permission === "granted") {
        console.log("Notification permission already granted");
        return;
    }

    document.addEventListener("click", handleUserInteraction, { once: true });
    document.addEventListener("touchstart", handleUserInteraction, {
        once: true,
    });
}