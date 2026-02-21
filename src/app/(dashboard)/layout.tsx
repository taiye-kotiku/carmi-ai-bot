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
            <div className="min-h-screen min-h-[100dvh] bg-gray-50" dir="rtl">
                <Sidebar />
                <MobileNav />
                <div className="lg:mr-64 flex flex-col min-h-screen min-h-[100dvh]">
                    <Header />
                    <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6 pb-20 lg:pb-6 max-w-7xl w-full mx-auto">
                        {children}
                    </main>
                </div>
                <Toaster position="top-center" richColors />
            </div>
        </NotificationProvider>
    );
}
