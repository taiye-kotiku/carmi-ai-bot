import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
});

export const metadata: Metadata = {
  title: "קוסם | פלטפורמה מבוססת AI ליצירת תוכן",
  description: "צור תמונות, סרטונים, קרוסלות – פלטפורמה אינטרנטית מבוססת בינה מלאכותית ליצירת תוכן ויזואלי",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <body className={heebo.className}>{children}</body>
    </html>
  );
}