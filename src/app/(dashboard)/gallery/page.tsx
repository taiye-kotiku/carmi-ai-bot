import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sparkles, Download, Trash2, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";
import { GalleryClient } from "./gallery-client";

export default async function GalleryPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const { data: generations } = await supabase
        .from("generations")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">הגלריה שלי</h1>
                    <p className="text-gray-600">
                        {generations?.length || 0} יצירות
                    </p>
                </div>
            </div>

            {/* Gallery Grid */}
            {generations && generations.length > 0 ? (
                <GalleryClient generations={generations} />
            ) : (
                <Card className="p-12 text-center">
                    <Sparkles className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium mb-2">הגלריה ריקה</h3>
                    <p className="text-gray-500 mb-4">התחל ליצור תוכן ותראה אותו כאן</p>
                </Card>
            )}
        </div>
    );
}