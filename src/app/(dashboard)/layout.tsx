import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Toaster } from "sonner";
import { NotificationProvider } from "@/lib/notifications/notification-context";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    return (
        <NotificationProvider>
            <div className="min-h-screen bg-gray-50" dir="rtl">
                <Sidebar />
                <MobileNav />
                <div className="lg:mr-64">
                    <Header />
                    <main className="p-4 lg:p-6 pb-24 lg:pb-6">{children}</main>
                </div>
                <Toaster position="top-center" richColors />
            </div>
        </NotificationProvider>
    );
}