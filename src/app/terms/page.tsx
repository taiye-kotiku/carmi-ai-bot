import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "תנאי שימוש | קוסם - פלטפורמה מבוססת AI ליצירת תוכן",
  description: "תנאי השימוש של קוסם – פלטפורמה אינטרנטית מבוססת בינה מלאכותית ליצירת תוכן ויזואלי",
};

export default function TermsPage() {
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
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold mb-8">תנאי שימוש</h1>
          <p className="text-gray-500 mb-12">עודכן לאחרונה: ינואר 2025</p>

          <div className="prose prose-lg max-w-none space-y-8 text-gray-700">
            <section>
              <h2 className="text-2xl font-semibold mb-4">1. הקדמה</h2>
              <p>
                ברוכים הבאים ל&quot;קוסם&quot; – פלטפורמה אינטרנטית מבוססת בינה מלאכותית ליצירת תוכן ויזואלי. שימוש בשירות מציין את הסכמתך
                לתנאים אלה. אנא קרא אותם בעיון לפני השימוש.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">2. תיאור השירות</h2>
              <p>
                קוסם היא פלטפורמה אינטרנטית מבוססת AI המאפשרת יצירת תוכן ויזואלי – תמונות, סרטונים,
                קרוסלות, המרת ריילים ועוד – דרך האתר. התוכן שנוצר מיועד לשימוש אישי ומקצועי
                ברשתות חברתיות.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">3. שימוש מותר</h2>
              <ul className="list-disc pr-6 space-y-2">
                <li>יצירת תוכן מקורי לחשבונות האישיים או העסקיים שלך</li>
                <li>שימוש בתוכן שנוצר לשיווק, פרסום ומיתוג</li>
                <li>המרת סרטונים לתמונות וקרוסלות</li>
                <li>יצירת תמונות מטקסט (Text-to-Image)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">4. שימוש אסור</h2>
              <ul className="list-disc pr-6 space-y-2">
                <li>יצירת תוכן פוגעני, מעליב או בלתי חוקי</li>
                <li>זיוף דמויות או זהויות של אנשים אמיתיים ללא הסכמתם</li>
                <li>הפצת דיסאינפורמציה או תוכן מטעה</li>
                <li>שימוש בתוכן שנוצר להפרת זכויות יוצרים של צד שלישי</li>
                <li>שימוש אוטומטי (בוטים) בניגוד להנחיות השירות</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">5. זכויות יוצרים</h2>
              <p>
                התוכן שאתה יוצר באמצעות קוסם שייך לך, בכפוף לתנאי השירות ולמדיניות הפלטפורמות
                בהן נעשה שימוש (אינסטגרם, פייסבוק וכו׳). אנו שומרים לעצמנו את הזכות להשתמש בתוכן
                באופן אנונימי לשיפור המודלים והשירות.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">6. מגבלות ואחריות</h2>
              <p>
                השירות ניתן &quot;כמות שהוא&quot;. איננו אחראים על איכות התוכן שנוצר, על התאמתו
                למטרות ספציפיות, או על נזקים עקיפים הנובעים משימוש בשירות. השימוש בתמונות של
                אנשים אמיתיים הוא באחריות המשתמש בלבד.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">7. תמחור ותשלומים</h2>
              <p>
                חלק מהשירותים ניתנים בחינם וחלקם בתשלום. התמחור המדויק מוצג באתר.
                ביטול מנויים יעשה בהתאם למדיניות הרישום והתשלום.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">8. שינויים</h2>
              <p>
                אנו שומרים לעצמנו את הזכות לעדכן את תנאי השימוש מעת לעת. המשך השימוש לאחר
                עדכון מהווה הסכמה לתנאים המעודכנים.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">9. צור קשר</h2>
              <p>
                לשאלות או הבהרות לגבי תנאי השימוש, ניתן לפנות אלינו דרך{" "}
                <Link href="/contact" className="text-primary underline hover:no-underline">
                  עמוד הצור קשר
                </Link>
                .
              </p>
            </section>
          </div>

          <div className="mt-12">
            <Button variant="outline" asChild>
              <Link href="/" className="flex items-center gap-2">
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
