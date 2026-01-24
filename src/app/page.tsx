import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Film, Image, Sparkles, Zap, Check } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen" dir="rtl">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🤖</span>
            <span className="text-xl font-bold">Hebrew AI</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">התחברות</Button>
            </Link>
            <Link href="/signup">
              <Button>התחל בחינם</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-full text-sm mb-6">
            <Sparkles className="h-4 w-4" />
            <span>הפלטפורמה הישראלית ליצירת תוכן עם AI</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            הפוך ריילים לקרוסלות
            <br />
            <span className="text-primary">ב-30 שניות</span>
          </h1>

          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            צור תמונות מדהימות, המר ריילים לקרוסלות, ובנה את המותג שלך -
            הכל במקום אחד עם בינה מלאכותית מתקדמת
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="text-lg px-8 h-14">
                <Zap className="h-5 w-5 ml-2" />
                התחל בחינם
              </Button>
            </Link>
            <Link href="#features">
              <Button size="lg" variant="outline" className="text-lg px-8 h-14">
                למד עוד
              </Button>
            </Link>
          </div>

          <p className="text-sm text-gray-500 mt-4">
            ✓ ללא כרטיס אשראי  ✓ 10 תמונות חינם  ✓ 2 המרות ריילים
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            כל מה שצריך ליצירת תוכן מקצועי
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border">
              <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                <Film className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">המרת ריל לקרוסלה</h3>
              <p className="text-gray-600">
                הדבק קישור לריל מאינסטגרם וקבל 10 תמונות מושלמות לקרוסלה.
                הAI בוחר את הפריימים הטובים ביותר.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border">
              <div className="h-12 w-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                <Image className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">יצירת תמונות עם AI</h3>
              <p className="text-gray-600">
                תאר את התמונה שאתה רוצה והבינה המלאכותית תיצור אותה.
                תומך בעברית ובאנגלית.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border">
              <div className="h-12 w-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                <Sparkles className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">מיתוג אוטומטי</h3>
              <p className="text-gray-600">
                הוסף את הלוגו שלך לכל תמונה באופן אוטומטי.
                בחר מיקום, גודל ושקיפות.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">תמחור פשוט</h2>
          <p className="text-gray-600 text-center mb-12">
            התחל בחינם, שדרג כשצריך
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Free Plan */}
            <div className="bg-white p-8 rounded-2xl border">
              <h3 className="text-lg font-semibold mb-2">חינם</h3>
              <div className="mb-4">
                <span className="text-4xl font-bold">₪0</span>
                <span className="text-gray-500">/חודש</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>10 יצירות תמונה</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>2 המרות ריל</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>5 קרוסלות</span>
                </li>
              </ul>
              <Link href="/signup">
                <Button variant="outline" className="w-full">
                  התחל בחינם
                </Button>
              </Link>
            </div>

            {/* Starter Plan */}
            <div className="bg-primary text-primary-foreground p-8 rounded-2xl relative">
              <div className="absolute -top-3 right-4 bg-yellow-400 text-yellow-900 text-xs font-medium px-3 py-1 rounded-full">
                הכי פופולרי
              </div>
              <h3 className="text-lg font-semibold mb-2">סטארטר</h3>
              <div className="mb-4">
                <span className="text-4xl font-bold">₪69</span>
                <span className="opacity-80">/חודש</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5" />
                  <span>100 יצירות תמונה</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5" />
                  <span>20 המרות ריל</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5" />
                  <span>50 קרוסלות</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5" />
                  <span>מיתוג אוטומטי</span>
                </li>
              </ul>
              <Link href="/signup?plan=starter">
                <Button variant="secondary" className="w-full">
                  בחר בתוכנית
                </Button>
              </Link>
            </div>

            {/* Pro Plan */}
            <div className="bg-white p-8 rounded-2xl border">
              <h3 className="text-lg font-semibold mb-2">מקצועי</h3>
              <div className="mb-4">
                <span className="text-4xl font-bold">₪179</span>
                <span className="text-gray-500">/חודש</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>500 יצירות תמונה</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>100 המרות ריל</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>200 קרוסלות</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>יצירת וידאו</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>גישה ל-API</span>
                </li>
              </ul>
              <Link href="/signup?plan=pro">
                <Button variant="outline" className="w-full">
                  בחר בתוכנית
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-2xl">🤖</span>
            <span className="text-xl font-bold">Hebrew AI</span>
          </div>
          <p className="text-gray-400 mb-8">
            הפלטפורמה הישראלית ליצירת תוכן עם בינה מלאכותית
          </p>
          <div className="flex items-center justify-center gap-6 text-gray-400">
            <Link href="/terms" className="hover:text-white">תנאי שימוש</Link>
            <Link href="/privacy" className="hover:text-white">פרטיות</Link>
            <Link href="/contact" className="hover:text-white">צור קשר</Link>
          </div>
          <p className="text-gray-500 text-sm mt-8">
            © 2025 Hebrew AI. כל הזכויות שמורות.
          </p>
        </div>
      </footer>
    </div>
  );
}