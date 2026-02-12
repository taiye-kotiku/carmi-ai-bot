"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HardDrive, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StorageInfo = {
    used_mb: number;
    limit_mb: number;
    percentage: number;
    is_over_warning: boolean;
    is_over_limit: boolean;
    auto_delete_after: string | null;
};

export function StorageWidget() {
    const [storage, setStorage] = useState<StorageInfo | null>(null);

    useEffect(() => {
        async function loadStorage() {
            try {
                const res = await fetch("/api/user/storage");
                if (res.ok) {
                    const data = await res.json();
                    setStorage(data);
                }
            } catch {
                // Silently fail
            }
        }
        loadStorage();

        // Also trigger cleanup check on load
        fetch("/api/user/storage/cleanup", { method: "POST" }).catch(() => { });
    }, []);

    if (!storage) return null;

    const getBarColor = () => {
        if (storage.percentage >= 100) return "bg-red-500";
        if (storage.percentage >= 80) return "bg-yellow-500";
        return "bg-green-500";
    };

    const daysUntilDelete = storage.auto_delete_after
        ? Math.max(
            0,
            Math.ceil(
                (new Date(storage.auto_delete_after).getTime() - Date.now()) /
                86400000
            )
        )
        : null;

    return (
        <Link href="/settings">
            <Card
                className={cn(
                    "hover:shadow-md transition-shadow cursor-pointer",
                    storage.is_over_limit && "border-red-200 bg-red-50",
                    storage.is_over_warning && !storage.is_over_limit && "border-yellow-200 bg-yellow-50"
                )}
            >
                <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            {storage.is_over_warning ? (
                                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            ) : (
                                <HardDrive className="h-4 w-4 text-gray-500" />
                            )}
                            <span>אחסון</span>
                        </div>
                        <span className="text-xs text-gray-500">
                            {storage.used_mb}MB / {storage.limit_mb}MB
                        </span>
                    </div>

                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className={cn("h-full rounded-full transition-all", getBarColor())}
                            style={{ width: `${Math.min(storage.percentage, 100)}%` }}
                        />
                    </div>

                    {daysUntilDelete !== null && daysUntilDelete <= 3 && (
                        <p className="text-[11px] text-red-600 mt-1.5 font-medium">
                            ⚠️ קבצים ישנים יימחקו אוטומטית בעוד{" "}
                            {daysUntilDelete === 0 ? "היום" : `${daysUntilDelete} ימים`}
                        </p>
                    )}
                </CardContent>
            </Card>
        </Link>
    );
}