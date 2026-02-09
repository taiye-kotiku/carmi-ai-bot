// src/app/layout.tsx
import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import { Toaster } from "sonner";
import { TranslationProvider } from "@/lib/i18n/provider";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
});

export const metadata: Metadata = {
  title: "קוסם | פלטפורמה מבוססת AI ליצירת תוכן",
  description: "צור תמונות, סרטונים, קרוסלות",
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
          <main>{children}</main>
          <Toaster position="top-center" richColors />
        </TranslationProvider>
      </body>
    </html>
  );
}