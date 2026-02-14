"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogFooter,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
    User,
    Settings,
    Trash2,
    LogOut,
    Shield,
    Mail,
    HardDrive,
    AlertTriangle,
    Plus,
    Coins,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CREDIT_COSTS } from "@/lib/config/credits"; // Import costs

type StorageInfo = {
    used_bytes: number;
    limit_bytes: number;
    used_mb: number;
    limit_mb: number;
    percentage: number;
    is_over_warning: boolean;
    is_over_limit: boolean;
    auto_delete_after: string | null;
};

export default function SettingsPage() {
    const router = useRouter();
    const supabase = createClient();

    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [deleteConfirmation, setDeleteConfirmation] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState("");
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [isSigningOut, setIsSigningOut] = useState(false);

    // Storage state
    const [storage, setStorage] = useState<StorageInfo | null>(null);
    const [storageLoading, setStorageLoading] = useState(true);
    const [showBuyDialog, setShowBuyDialog] = useState(false);
    const [buyAmount, setBuyAmount] = useState(50); // Default to 50MB
    const [isBuying, setIsBuying] = useState(false);
    const [buyError, setBuyError] = useState("");

    const BASE_MB = 50;
    const BASE_COST = CREDIT_COSTS.storage_expansion || 15;

    // Helper to calculate cost dynamically
    const calculateCost = (mb: number) => (mb / BASE_MB) * BASE_COST;

    useEffect(() => {
        async function load() {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            setUser(user);
            setLoading(false);
        }
        load();
        loadStorage();
    }, [supabase]);

    async function loadStorage() {
        setStorageLoading(true);
        try {
            const res = await fetch("/api/user/storage");
            if (res.ok) {
                const data = await res.json();
                setStorage(data);
            }
        } catch {
            // fail silently
        }
        setStorageLoading(false);
    }

    const handleSignOut = async () => {
        setIsSigningOut(true);
        await supabase.auth.signOut();
        router.push("/login");
    };

    const handleDeleteAccount = async () => {
        if (deleteConfirmation !== "מחק את החשבון שלי") {
            setDeleteError('אנא הקלד "מחק את החשבון שלי" כדי לאשר');
            return;
        }
        setIsDeleting(true);
        setDeleteError("");
        try {
            const response = await fetch("/api/user/delete", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "שגיאה במחיקת החשבון");
            await supabase.auth.signOut();
            router.push("/login?deleted=true");
        } catch (error: any) {
            setDeleteError(error.message || "שגיאה במחיקת החשבון. נסה שוב מאוחר יותר.");
            setIsDeleting(false);
        }
    };

    const handleBuyStorage = async () => {
        setIsBuying(true);
        setBuyError("");
        try {
            const res = await fetch("/api/user/storage", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount_mb: buyAmount }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "רכישת האחסון נכשלה");
            setShowBuyDialog(false);
            await loadStorage();
            router.refresh(); // Refresh credits display
        } catch (error: any) {
            setBuyError(error.message);
        }
        setIsBuying(false);
    };

    const getBarColor = () => {
        if (!storage) return "bg-green-500";
        if (storage.percentage >= 100) return "bg-red-500";
        if (storage.percentage >= 80) return "bg-yellow-500";
        return "bg-green-500";
    };

    const daysUntilDelete =
        storage?.auto_delete_after
            ? Math.max(
                0,
                Math.ceil(
                    (new Date(storage.auto_delete_after).getTime() - Date.now()) /
                    86400000
                )
            )
            : null;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto p-6 space-y-8" dir="rtl">
            {/* Page Header */}
            <div className="space-y-2">
                <h1 className="text-3xl font-bold flex items-center gap-3">
                    <Settings className="h-8 w-8 text-purple-500" />
                    הגדרות
                </h1>
                <p className="text-gray-500">נהל את החשבון, האחסון וההעדפות שלך</p>
            </div>

            {/* Profile Info Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5 text-purple-500" />
                        פרטי חשבון
                    </CardTitle>
                    <CardDescription>המידע הבסיסי של החשבון שלך</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            כתובת אימייל
                        </Label>
                        <Input
                            value={user?.email || ""}
                            disabled
                            className="bg-gray-50 cursor-not-allowed"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            שיטת התחברות
                        </Label>
                        <Input
                            value={
                                user?.app_metadata?.provider === "google"
                                    ? "Google"
                                    : user?.app_metadata?.provider === "email"
                                        ? "אימייל וסיסמה"
                                        : user?.app_metadata?.provider || "לא ידוע"
                            }
                            disabled
                            className="bg-gray-50 cursor-not-allowed"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>תאריך הצטרפות</Label>
                        <Input
                            value={
                                user?.created_at
                                    ? new Date(user.created_at).toLocaleDateString("he-IL", {
                                        year: "numeric",
                                        month: "long",
                                        day: "numeric",
                                    })
                                    : ""
                            }
                            disabled
                            className="bg-gray-50 cursor-not-allowed"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Storage Management */}
            <Card
                className={cn(
                    storage?.is_over_limit && "border-red-200",
                    storage?.is_over_warning &&
                    !storage?.is_over_limit &&
                    "border-yellow-200"
                )}
            >
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <HardDrive className="h-5 w-5 text-blue-500" />
                        ניהול אחסון
                    </CardTitle>
                    <CardDescription>נהל את שטח האחסון של הקבצים שלך</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {storageLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                        </div>
                    ) : storage ? (
                        <>
                            {/* Usage Bar */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">שימוש באחסון</span>
                                    <span className="font-semibold">
                                        {storage.used_mb}MB / {storage.limit_mb}MB
                                    </span>
                                </div>
                                <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                        className={cn(
                                            "h-full rounded-full transition-all duration-500",
                                            getBarColor()
                                        )}
                                        style={{
                                            width: `${Math.min(storage.percentage, 100)}%`,
                                        }}
                                    />
                                </div>
                                <p className="text-xs text-gray-400">
                                    {storage.percentage}% בשימוש
                                </p>
                            </div>

                            {/* Warning Banner */}
                            {storage.is_over_warning && (
                                <div
                                    className={cn(
                                        "rounded-lg p-4 flex items-start gap-3",
                                        storage.is_over_limit
                                            ? "bg-red-50 border border-red-200"
                                            : "bg-yellow-50 border border-yellow-200"
                                    )}
                                >
                                    <AlertTriangle
                                        className={cn(
                                            "h-5 w-5 mt-0.5 flex-shrink-0",
                                            storage.is_over_limit
                                                ? "text-red-500"
                                                : "text-yellow-500"
                                        )}
                                    />
                                    <div>
                                        <p
                                            className={cn(
                                                "font-semibold text-sm",
                                                storage.is_over_limit
                                                    ? "text-red-700"
                                                    : "text-yellow-700"
                                            )}
                                        >
                                            {storage.is_over_limit
                                                ? "האחסון שלך מלא!"
                                                : "האחסון שלך כמעט מלא"}
                                        </p>
                                        <p className="text-xs text-gray-600 mt-1">
                                            {storage.is_over_limit
                                                ? "רכוש אחסון נוסף כדי למנוע מחיקה אוטומטית של קבצים ישנים."
                                                : "שקול לרכוש אחסון נוסף כדי למנוע מחיקת קבצים."}
                                        </p>
                                        {daysUntilDelete !== null && (
                                            <p className="text-xs text-red-600 font-semibold mt-2">
                                                ⚠️ קבצים ישנים יימחקו אוטומטית בעוד{" "}
                                                {daysUntilDelete === 0
                                                    ? "היום"
                                                    : `${daysUntilDelete} ימים`}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Storage Actions */}
                            <div className="flex flex-wrap gap-3">
                                <Button
                                    onClick={() => setShowBuyDialog(true)}
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    <Plus className="h-4 w-4 ml-2" />
                                    רכוש אחסון נוסף
                                </Button>
                            </div>

                            {/* Info */}
                            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                                <h4 className="text-sm font-semibold text-gray-700">
                                    איך זה עובד?
                                </h4>
                                <ul className="text-xs text-gray-500 space-y-1.5">
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-500 mt-0.5">•</span>
                                        כל משתמש מקבל 100MB אחסון בסיסי
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-yellow-500 mt-0.5">•</span>
                                        ב-80% תתקבל התראה
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-red-500 mt-0.5">•</span>
                                        ב-100% — קבצים ישנים יימחקו אוטומטית אחרי 3 ימים
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-500 mt-0.5">•</span>
                                        {BASE_COST} קרדיטים = {BASE_MB}MB אחסון נוסף
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-gray-400 mt-0.5">•</span>
                                        רשומות היצירות נשמרות גם אחרי מחיקת קבצים
                                    </li>
                                </ul>
                            </div>
                        </>
                    ) : (
                        <p className="text-gray-400 text-sm">לא ניתן לטעון מידע אחסון</p>
                    )}
                </CardContent>
            </Card>

            {/* Sign Out */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <LogOut className="h-5 w-5 text-yellow-500" />
                        התנתקות
                    </CardTitle>
                    <CardDescription>התנתק מהחשבון שלך במכשיר זה</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button
                        onClick={handleSignOut}
                        disabled={isSigningOut}
                        variant="outline"
                        className="border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                    >
                        {isSigningOut ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-500 ml-2" />
                                מתנתק...
                            </>
                        ) : (
                            <>
                                <LogOut className="h-4 w-4 ml-2" />
                                התנתק
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-red-200">
                <CardHeader>
                    <CardTitle className="text-red-600 flex items-center gap-2">
                        <Trash2 className="h-5 w-5" />
                        אזור מסוכן
                    </CardTitle>
                    <CardDescription>פעולות בלתי הפיכות</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-lg border border-red-100 bg-red-50/50 p-4 space-y-3">
                        <h3 className="text-red-700 font-semibold text-sm">מחיקת חשבון</h3>
                        <p className="text-gray-600 text-xs leading-relaxed">
                            מחיקת החשבון שלך היא פעולה{" "}
                            <span className="text-red-600 font-bold">בלתי הפיכה</span>. כל
                            הנתונים שלך יימחקו לצמיתות.
                        </p>
                        <Button
                            onClick={() => setShowDeleteDialog(true)}
                            variant="outline"
                            size="sm"
                            className="border-red-300 text-red-600 hover:bg-red-50"
                        >
                            <Trash2 className="h-4 w-4 ml-2" />
                            מחק את החשבון שלי
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Delete Confirmation Dialog */}
            <AlertDialog
                open={showDeleteDialog}
                onOpenChange={(open) => {
                    setShowDeleteDialog(open);
                    if (!open) {
                        setDeleteConfirmation("");
                        setDeleteError("");
                    }
                }}
            >
                <AlertDialogContent className="bg-white border-gray-200" dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-600 flex items-center gap-2">
                            <Trash2 className="h-5 w-5" />
                            אישור מחיקת חשבון
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="text-gray-500 space-y-4">
                                <p>
                                    פעולה זו{" "}
                                    <span className="text-red-600 font-bold">בלתי הפיכה</span>.
                                    כל הנתונים שלך יימחקו לצמיתות.
                                </p>
                                <div className="space-y-2">
                                    <Label className="text-gray-600 text-sm">
                                        הקלד{" "}
                                        <span className="font-bold text-red-600">
                                            &quot;מחק את החשבון שלי&quot;
                                        </span>{" "}
                                        כדי לאשר:
                                    </Label>
                                    <Input
                                        value={deleteConfirmation}
                                        onChange={(e) => {
                                            setDeleteConfirmation(e.target.value);
                                            setDeleteError("");
                                        }}
                                        placeholder="מחק את החשבון שלי"
                                        className="text-right"
                                        dir="rtl"
                                    />
                                    {deleteError && (
                                        <p className="text-red-500 text-sm">{deleteError}</p>
                                    )}
                                </div>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            onClick={() => {
                                setShowDeleteDialog(false);
                                setDeleteConfirmation("");
                                setDeleteError("");
                            }}
                        >
                            ביטול
                        </AlertDialogCancel>
                        <Button
                            onClick={handleDeleteAccount}
                            disabled={
                                isDeleting || deleteConfirmation !== "מחק את החשבון שלי"
                            }
                            className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                        >
                            {isDeleting ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2" />
                                    מוחק...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="h-4 w-4 ml-2" />
                                    מחק לצמיתות
                                </>
                            )}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Buy Storage Dialog */}
            <AlertDialog
                open={showBuyDialog}
                onOpenChange={(open) => {
                    setShowBuyDialog(open);
                    if (!open) {
                        setBuyError("");
                        setBuyAmount(50);
                    }
                }}
            >
                <AlertDialogContent className="bg-white border-gray-200" dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-blue-600 flex items-center gap-2">
                            <HardDrive className="h-5 w-5" />
                            רכישת אחסון נוסף
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="text-gray-500 space-y-4">
                                <p>בחר כמה אחסון נוסף תרצה לרכוש:</p>

                                <div className="grid grid-cols-3 gap-3">
                                    {[50, 100, 200].map((amount) => (
                                        <button
                                            key={amount}
                                            onClick={() => setBuyAmount(amount)}
                                            className={cn(
                                                "rounded-lg border-2 p-3 text-center transition-all",
                                                buyAmount === amount
                                                    ? "border-blue-500 bg-blue-50"
                                                    : "border-gray-200 hover:border-gray-300"
                                            )}
                                        >
                                            <div className="text-lg font-bold text-gray-900">
                                                {amount}MB
                                            </div>
                                            <div className="text-xs text-gray-500 flex items-center justify-center gap-1 mt-1">
                                                <Coins className="h-3 w-3" />
                                                {calculateCost(amount)} קרדיטים
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                <div className="bg-blue-50 rounded-lg p-3 text-sm">
                                    <div className="flex justify-between">
                                        <span>אחסון נוסף:</span>
                                        <span className="font-semibold">{buyAmount}MB</span>
                                    </div>
                                    <div className="flex justify-between mt-1">
                                        <span>עלות:</span>
                                        <span className="font-semibold text-blue-600">
                                            {calculateCost(buyAmount)} קרדיטים
                                        </span>
                                    </div>
                                    {storage && (
                                        <div className="flex justify-between mt-1 pt-1 border-t border-blue-100">
                                            <span>מכסה חדשה:</span>
                                            <span className="font-semibold">
                                                {storage.limit_mb + buyAmount}MB
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {buyError && (
                                    <p className="text-red-500 text-sm">{buyError}</p>
                                )}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setShowBuyDialog(false)}>
                            ביטול
                        </AlertDialogCancel>
                        <Button
                            onClick={handleBuyStorage}
                            disabled={isBuying}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            {isBuying ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2" />
                                    רוכש...
                                </>
                            ) : (
                                <>
                                    <Plus className="h-4 w-4 ml-2" />
                                    רכוש {buyAmount}MB
                                </>
                            )}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}