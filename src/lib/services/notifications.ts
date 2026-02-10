// Push notification service for generation completion

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<boolean> {
    if (!("Notification" in window)) {
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
 * Show a notification
 */
export function showNotification(title: string, options?: NotificationOptions): void {
    if (!("Notification" in window) || Notification.permission !== "granted") {
        return;
    }

    const notification = new Notification(title, {
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        ...options,
    });

    notification.onclick = () => {
        window.focus();
        notification.close();
    };

    // Auto-close after 5 seconds
    setTimeout(() => {
        notification.close();
    }, 5000);
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
    const countText = count && count > 1 ? ` (${count} ${typeName === "תמונה" ? "תמונות" : typeName})` : "";
    
    showNotification(`היצירה הושלמה! 🎉`, {
        body: `ה${typeName} שלך מוכן${countText}`,
        tag: `generation-${Date.now()}`,
    });
}

/**
 * Initialize notifications on page load
 */
export function initNotifications(): void {
    if (typeof window === "undefined") return;
    
    // Request permission on user interaction
    const handleUserInteraction = () => {
        requestNotificationPermission().then((granted) => {
            if (granted) {
                console.log("Notification permission granted");
            }
        });
        // Remove listeners after first interaction
        document.removeEventListener("click", handleUserInteraction);
        document.removeEventListener("touchstart", handleUserInteraction);
    };

    document.addEventListener("click", handleUserInteraction, { once: true });
    document.addEventListener("touchstart", handleUserInteraction, { once: true });
}
