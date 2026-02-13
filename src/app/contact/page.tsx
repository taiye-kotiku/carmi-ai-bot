// src/app/contact/page.tsx

"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowRight,
  Mail,
  Send,
  Loader2,
  CheckCircle,
  Globe,
  Clock,
  MessageSquare,
} from "lucide-react";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      subject: formData.get("subject") as string,
      message: formData.get("message") as string,
    };

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "שליחת ההודעה נכשלה");
      }

      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "אירעה שגיאה. נסה שוב."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white" dir="rtl">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🧙</span>
            <span className="text-xl font-bold">kossem</span>
          </Link>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/login">התחברות</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">התחל בחינם</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Title */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
              <MessageSquare className="h-4 w-4" />
              <span>דברו איתנו</span>
            </div>
            <h1 className="text-4xl font-bold mb-4 text-gray-900">צור קשר</h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              יש לך שאלות, הצעות או צריך עזרה? הצוות שלנו כאן בשבילך
            </p>
          </div>

          {/* Contact Info Cards */}
          <div className="grid md:grid-cols-3 gap-4 mb-12">
            <Card className="text-center border-2 hover:border-purple-200 transition-colors">
              <CardContent className="pt-6">
                <div className="h-12 w-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Mail className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">אימייל</h3>
                <a
                  href="mailto:support@kossem.co.il"
                  className="text-purple-600 hover:underline text-sm"
                >
                  support@kossem.co.il
                </a>
              </CardContent>
            </Card>

            <Card className="text-center border-2 hover:border-purple-200 transition-colors">
              <CardContent className="pt-6">
                <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">זמן מענה</h3>
                <p className="text-gray-500 text-sm">עד 48 שעות עסקים</p>
              </CardContent>
            </Card>

            <Card className="text-center border-2 hover:border-purple-200 transition-colors">
              <CardContent className="pt-6">
                <div className="h-12 w-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Globe className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">אתר</h3>
                <a
                  href="https://kossem.co.il"
                  className="text-green-600 hover:underline text-sm"
                >
                  kossem.co.il
                </a>
              </CardContent>
            </Card>
          </div>

          {/* Contact Form */}
          <Card className="max-w-2xl mx-auto border-2 shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl">שלח לנו הודעה</CardTitle>
              <CardDescription>מלא את הפרטים ונחזור אליך בהקדם</CardDescription>
            </CardHeader>
            <CardContent>
              {submitted ? (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    ההודעה נשלחה בהצלחה! ✓
                  </h3>
                  <p className="text-gray-600 mb-2">
                    קיבלנו את הפנייה שלך ונחזור אליך בהקדם האפשרי.
                  </p>
                  <p className="text-sm text-gray-400">
                    שלחנו לך גם אישור למייל שהזנת.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-6"
                    onClick={() => setSubmitted(false)}
                  >
                    שלח הודעה נוספת
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">שם מלא</Label>
                      <Input
                        id="name"
                        name="name"
                        placeholder="הכנס את שמך"
                        required
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">אימייל</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="example@email.com"
                        required
                        disabled={loading}
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject">נושא</Label>
                    <Input
                      id="subject"
                      name="subject"
                      placeholder="במה נוכל לעזור?"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message">הודעה</Label>
                    <Textarea
                      id="message"
                      name="message"
                      placeholder="כתוב את הודעתך כאן..."
                      rows={5}
                      required
                      disabled={loading}
                    />
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full sm:w-auto"
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 ml-2" />
                    )}
                    {loading ? "שולח..." : "שלח הודעה"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* FAQ hint */}
          <div className="mt-12 text-center">
            <p className="text-gray-500 text-sm mb-4">
              לפני שתפנה אלינו, אולי התשובה כבר נמצאת בעמוד העזרה?
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button variant="outline" asChild>
                <Link href="/help" className="flex items-center gap-2">
                  עזרה ותמיכה
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/" className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  חזרה לדף הבית
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-6 text-gray-400">
            <Link href="/terms" className="hover:text-white transition-colors">
              תנאי שימוש
            </Link>
            <Link href="/privacy" className="hover:text-white transition-colors">
              פרטיות
            </Link>
            <Link href="/contact" className="hover:text-white transition-colors">
              צור קשר
            </Link>
          </div>
          <p className="text-gray-500 text-sm mt-4">
            © 2025 kossem. כל הזכויות שמורות.
          </p>
        </div>
      </footer>
    </div>
  );
}