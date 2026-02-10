import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
    Sparkles,
    Film,
    Images,
    Palette,
    CreditCard,
    ArrowLeft,
    Clock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";

export default async function DashboardPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Fetch user data
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
            name: "יצירת תמונה",
            description: "צור תמונה מתיאור טקסט",
            href: "/generate/image",
            icon: Sparkles,
            color: "bg-purple-50 text-purple-600 hover:bg-purple-100",
        },
        {
            name: "המרת רילז",
            description: "הפוך רילז לקרוסלה",
            href: "/generate/reel-converter",
            icon: Film,
            color: "bg-blue-50 text-blue-600 hover:bg-blue-100",
            badge: "⭐",
        },
        {
            name: "יצירת קרוסלה",
            description: "צור קרוסלה מתמונות",
            href: "/generate/carousel",
            icon: Images,
            color: "bg-green-50 text-green-600 hover:bg-green-100",
        },
    ];

    return (
        <div className="space-y-8">
            {/* Welcome */}
            <div>
                <h1 className="text-3xl font-bold mb-2">
                    שלום{profile?.name ? `, ${profile.name}` : ""}! 👋
                </h1>
                <p className="text-gray-600">מה תרצה ליצור היום?</p>
            </div>

            {/* Credits Overview */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        הקרדיטים שלך
                    </CardTitle>
                    <Link href="/credits">
                        <Button variant="ghost" size="sm">
                            פרטים נוספים
                            <ArrowLeft className="h-4 w-4 mr-2" />
                        </Button>
                    </Link>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <CreditSlider
                            credits={credits}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Quick Actions */}
            <div>
                <h2 className="text-lg font-semibold mb-4">פעולות מהירות</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {quickActions.map((action) => (
                        <Link key={action.name} href={action.href}>
                            <Card className={`h-full transition-colors cursor-pointer ${action.color}`}>
                                <CardContent className="p-6 relative">
                                    {action.badge && (
                                        <span className="absolute top-3 left-3 text-sm">
                                            {action.badge}
                                        </span>
                                    )}
                                    <action.icon className="h-8 w-8 mb-4" />
                                    <h3 className="font-semibold mb-1">{action.name}</h3>
                                    <p className="text-sm opacity-80">{action.description}</p>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Recent Generations */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">יצירות אחרונות</h2>
                    <Link href="/gallery">
                        <Button variant="ghost" size="sm">
                            הצג הכל
                            <ArrowLeft className="h-4 w-4 mr-2" />
                        </Button>
                    </Link>
                </div>

                {generations.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {generations.map((gen) => (
                            <Card key={gen.id} className="overflow-hidden group">
                                <div className="aspect-square relative">
                                    <img
                                        src={gen.thumbnail_url || gen.result_urls?.[0]}
                                        alt={gen.prompt || "Generated"}
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Badge variant="secondary">
                                            {gen.type === "image" && "תמונה"}
                                            {gen.type === "reel" && "רילז"}
                                            {gen.type === "carousel" && "קרוסלה"}
                                        </Badge>
                                    </div>
                                </div>
                                <CardContent className="p-2">
                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                        <Clock className="h-3 w-3" />
                                        <span>{formatRelativeTime(gen.created_at)}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <Card className="p-12 text-center">
                        <Sparkles className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <h3 className="text-lg font-medium mb-2">עדיין אין יצירות</h3>
                        <p className="text-gray-500 mb-4">התחל ליצור תוכן עכשיו!</p>
                        <Link href="/generate/image">
                            <Button>צור תמונה ראשונה</Button>
                        </Link>
                    </Card>
                )}
            </div>
        </div>
    );
}

function CreditSlider({ credits }: { credits: any }) {
    // Credit costs
    const creditCosts = {
        carousel: 3,
        image: 2,
        video: 20,
        reel: 4,
        videoSlicing: 20,
    };

    // Current credit values
    const carouselCredits = credits?.carousel_credits || 0;
    const imageCredits = credits?.image_credits || 0;
    const videoCredits = credits?.video_credits || 0;
    const reelCredits = credits?.reel_credits || 0;
    const videoSlicingCredits = credits?.reel_credits || 0; // Using reel_credits for video slicing

    // Calculate total available credits (weighted by cost)
    const totalWeightedCredits = 
        Math.floor(carouselCredits / creditCosts.carousel) +
        Math.floor(imageCredits / creditCosts.image) +
        Math.floor(videoCredits / creditCosts.video) +
        Math.floor(reelCredits / creditCosts.reel) +
        Math.floor(videoSlicingCredits / creditCosts.videoSlicing);

    // Maximum possible credits (for display purposes)
    const maxDisplayCredits = 100; // Adjust based on your needs

    const percentage = Math.min((totalWeightedCredits / maxDisplayCredits) * 100, 100);

    return (
        <div className="space-y-4">
            {/* Single Progress Bar */}
            <div className="space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-600 font-medium">סה"כ קרדיטים זמינים</span>
                    <span className="font-bold text-lg text-gray-900">{totalWeightedCredits}</span>
                </div>
                <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-purple-500 via-blue-500 to-green-500 transition-all"
                        style={{ width: `${percentage}%` }}
                    />
                </div>
            </div>
        </div>
    );
}