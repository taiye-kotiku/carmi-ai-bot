// src/app/layout.tsx
import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import { Toaster } from "sonner";
import { TranslationProvider } from "@/lib/i18n/provider";
import { NotificationInit } from "@/components/notification-init";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
});

export const metadata: Metadata = {
  title: "kossem | פלטפורמה מבוססת AI ליצירת תוכן",
  description: "צור תמונות, סרטונים, קרוסלות ותוכן ויזואלי מדהים עם בינה מלאכותית - kossem.co.il",
  metadataBase: new URL("https://kossem.co.il"),
  openGraph: {
    title: "kossem | פלטפורמה מבוססת AI ליצירת תוכן",
    description: "צור תמונות, סרטונים, קרוסלות ותוכן ויזואלי מדהים עם בינה מלאכותית",
    url: "https://kossem.co.il",
    siteName: "kossem",
    locale: "he_IL",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <head />
      <body className={heebo.className} suppressHydrationWarning>
        <TranslationProvider>
          <NotificationInit />
          <main>{children}</main>
          <Toaster position="top-center" richColors />
        </TranslationProvider>
      </body>
    </html>
  );
}