import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
    Sparkles,
    Film,
    Images,
    CreditCard,
    ArrowLeft,
    Clock,
    Wand2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";
import { CREDIT_COSTS } from "@/lib/config/credits";
import { StorageWidget } from "@/components/features/storage-widget";

export default async function DashboardPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const [profileRes, creditsRes, generationsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("credits").select("*").eq("user_id", user.id).single(),
        supabase
            .from("generations")
            .select("*")
            .eq("user_id", user.id)
            .eq("status", "completed")
            .order("created_at", { ascending: false })
            .limit(6),
    ]);

    const profile = profileRes.data;
    const credits = creditsRes.data;
    const generations = generationsRes.data || [];

    const quickActions = [
        {
            name: "מרכז יצירתי",
            description: "תמונה, קרוסלה, וידאו וסטורי ממקום אחד",
            href: "/generate/creative-hub",
            icon: Sparkles,
            color: "bg-purple-50 text-purple-600 hover:bg-purple-100 border-purple-100",
            badge: "חדש",
        },
        {
            name: "יצירת תמונה",
            description: "צור תמונה מתיאור טקסט",
            href: "/generate/text-to-image",
            icon: Sparkles,
            color: "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-indigo-100",
        },
        {
            name: "וידאו לתמונות",
            description: "חלץ תמונות נבחרות מוידאו",
            href: "/generate/video-to-images",
            icon: Film,
            color: "bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-100",
        },
        {
            name: "יצירת קרוסלה",
            description: "צור קרוסלה ממותגת",
            href: "/generate/carousel",
            icon: Images,
            color: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-100",
        },
        {
            name: "הנפשת תמונה",
            description: "הפוך תמונה לסרטון",
            href: "/generate/image-to-video",
            icon: Wand2,
            color: "bg-amber-50 text-amber-600 hover:bg-amber-100 border-amber-100",
        },
    ];

    return (
        <div className="space-y-6 sm:space-y-8">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold mb-1">
                    שלום{profile?.name ? `, ${profile.name}` : ""}!
                </h1>
                <p className="text-gray-500 text-sm sm:text-base">מה תרצה ליצור היום?</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="sm:col-span-2 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                            <CreditCard className="h-5 w-5 text-purple-500" />
                            הקרדיטים שלך
                        </CardTitle>
                        <Link href="/credits">
                            <Button variant="ghost" size="sm" className="text-purple-600 hover:text-purple-700">
                                פרטים
                                <ArrowLeft className="h-4 w-4 mr-1" />
                            </Button>
                        </Link>
                    </CardHeader>
                    <CardContent>
                        <CreditDisplay credits={credits} />
                    </CardContent>
                </Card>

                <StorageWidget />
            </div>

            <div>
                <h2 className="text-base sm:text-lg font-semibold mb-3">פעולות מהירות</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {quickActions.map((action) => (
                        <Link key={action.name} href={action.href}>
                            <Card
                                className={`h-full transition-all duration-200 cursor-pointer border ${action.color} hover:shadow-md active:scale-[0.98]`}
                            >
                                <CardContent className="p-4 sm:p-5 relative">
                                    {action.badge && (
                                        <span className="absolute top-2 left-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500 text-white">
                                            {action.badge}
                                        </span>
                                    )}
                                    <action.icon className="h-6 w-6 sm:h-7 sm:w-7 mb-2.5" />
                                    <h3 className="font-semibold text-sm sm:text-base mb-0.5">{action.name}</h3>
                                    <p className="text-xs opacity-70 leading-relaxed hidden sm:block">{action.description}</p>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            </div>

            <div>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base sm:text-lg font-semibold">יצירות אחרונות</h2>
                    <Link href="/gallery">
                        <Button variant="ghost" size="sm" className="text-purple-600 hover:text-purple-700">
                            הצג הכל
                            <ArrowLeft className="h-4 w-4 mr-1" />
                        </Button>
                    </Link>
                </div>

                {generations.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
                        {generations.map((gen) => (
                            <Card key={gen.id} className="overflow-hidden group cursor-pointer hover:shadow-md transition-shadow duration-200">
                                <div className="aspect-square relative">
                                    {gen.files_deleted ? (
                                        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                            <p className="text-[10px] text-gray-400 text-center px-1">
                                                קובץ נמחק
                                            </p>
                                        </div>
                                    ) : (
                                        <img
                                            src={gen.thumbnail_url || gen.result_urls?.[0]}
                                            alt={gen.prompt || "Generated"}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    )}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                                        <Badge variant="secondary" className="text-[10px]">
                                            {gen.type === "image" && "תמונה"}
                                            {gen.type === "reel" && "רילז"}
                                            {gen.type === "carousel" && "קרוסלה"}
                                            {gen.type === "video" && "סרטון"}
                                        </Badge>
                                    </div>
                                </div>
                                <CardContent className="p-1.5 sm:p-2">
                                    <div className="flex items-center gap-1 text-[10px] sm:text-xs text-gray-400">
                                        <Clock className="h-3 w-3" />
                                        <span>{formatRelativeTime(gen.created_at)}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <Card className="p-8 sm:p-12 text-center shadow-sm">
                        <Sparkles className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 text-gray-300" />
                        <h3 className="text-base sm:text-lg font-medium mb-1">עדיין אין יצירות</h3>
                        <p className="text-gray-500 text-sm mb-4">התחל ליצור תוכן עכשיו!</p>
                        <Link href="/generate/creative-hub">
                            <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700">
                                צור עכשיו
                            </Button>
                        </Link>
                    </Card>
                )}
            </div>
        </div>
    );
}

function CreditDisplay({ credits }: { credits: any }) {
    const totalCredits = credits?.credits || 0;

    const capabilities = [
        { label: "תמונות", cost: CREDIT_COSTS.image_generation, icon: Sparkles, color: "text-purple-500" },
        { label: "קרוסלות", cost: CREDIT_COSTS.carousel_generation, icon: Images, color: "text-emerald-500" },
        { label: "סרטונים", cost: CREDIT_COSTS.video_generation, icon: Film, color: "text-blue-500" },
        { label: "אימון דמות", cost: CREDIT_COSTS.character_training, icon: Wand2, color: "text-amber-500" },
    ];

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                    <span className="text-gray-500 text-sm">קרדיטים זמינים</span>
                    <span className="font-bold text-2xl sm:text-3xl text-gray-900">
                        {totalCredits}
                    </span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500 rounded-full"
                        style={{
                            width: `${Math.min((totalCredits / 500) * 100, 100)}%`,
                        }}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {capabilities.map((cap) => {
                    const possible = cap.cost === 0 ? null : Math.floor(totalCredits / cap.cost);
                    return (
                        <div
                            key={cap.label}
                            className="text-center p-2.5 rounded-lg bg-gray-50 border border-gray-100"
                        >
                            <cap.icon className={`h-4 w-4 mx-auto mb-1 ${cap.color}`} />
                            <div className="text-sm font-bold text-gray-900">
                                {possible === null ? "---" : possible}
                            </div>
                            <div className="text-[11px] text-gray-500">{cap.label}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
