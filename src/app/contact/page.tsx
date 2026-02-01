"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Mail, Send } from "lucide-react";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // In production, this would send to an API
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen" dir="rtl">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🧙</span>
            <span className="text-xl font-bold">קוסם</span>
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
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">צור קשר</h1>
            <p className="text-xl text-gray-600">
              יש לך שאלות, הצעות או צריך עזרה? נשמח לשמוע ממך
            </p>
          </div>

          <div className="mb-12">
            <Card>
              <CardHeader>
                <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center mb-2">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>אימייל</CardTitle>
                <CardDescription>נענה תוך 24-48 שעות</CardDescription>
              </CardHeader>
              <CardContent>
                <a
                  href="mailto:kossem.yotzer@gmail.com"
                  className="text-primary hover:underline font-medium"
                >
                  kossem.yotzer@gmail.com
                </a>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>שלח לנו הודעה</CardTitle>
              <CardDescription>מלא את הפרטים ונחזור אליך בהקדם</CardDescription>
            </CardHeader>
            <CardContent>
              {submitted ? (
                <div className="py-8 text-center">
                  <p className="text-lg text-green-600 font-medium mb-2">ההודעה נשלחה בהצלחה! ✓</p>
                  <p className="text-gray-600">נחזור אליך בהקדם האפשרי.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">שם מלא</Label>
                      <Input id="name" name="name" placeholder="הכנס את שמך" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">אימייל</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="example@email.com"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject">נושא</Label>
                    <Input id="subject" name="subject" placeholder="במה נוכל לעזור?" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message">הודעה</Label>
                    <Textarea
                      id="message"
                      name="message"
                      placeholder="כתוב את הודעתך כאן..."
                      rows={5}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full sm:w-auto">
                    <Send className="h-4 w-4 ml-2" />
                    שלח הודעה
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <div className="mt-12 text-center">
            <Button variant="outline" asChild>
              <Link href="/" className="flex items-center gap-2 justify-center mx-auto">
                <ArrowRight className="h-4 w-4" />
                חזרה לדף הבית
              </Link>
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-6 text-gray-400">
            <Link href="/terms" className="hover:text-white">תנאי שימוש</Link>
            <Link href="/privacy" className="hover:text-white">פרטיות</Link>
            <Link href="/contact" className="hover:text-white">צור קשר</Link>
          </div>
          <p className="text-gray-500 text-sm mt-4">© 2025 קוסם. כל הזכויות שמורות.</p>
        </div>
      </footer>
    </div>
  );
}
