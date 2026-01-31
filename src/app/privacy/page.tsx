import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "מדיניות פרטיות | קוסם - פלטפורמה מבוססת AI ליצירת תוכן",
  description: "מדיניות הפרטיות של קוסם – פלטפורמה אינטרנטית מבוססת בינה מלאכותית ליצירת תוכן ויזואלי",
};

export default function PrivacyPage() {
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
          <h1 className="text-4xl font-bold mb-8">מדיניות פרטיות</h1>
          <p className="text-gray-500 mb-12">עודכן לאחרונה: ינואר 2025</p>

          <div className="prose prose-lg max-w-none space-y-8 text-gray-700">
            <section>
              <h2 className="text-2xl font-semibold mb-4">1. הקדמה</h2>
              <p>
                קוסם (&quot;אנחנו&quot;, &quot;שלנו&quot;) מכבד את פרטיותך. מדיניות פרטיות זו מתארת אילו מידעים אנחנו אוספים,
                כיצד אנחנו משתמשים בהם, ומהם זכויותיך ביחס למידע זה. השימוש בפלטפורמה קוסם – פלטפורמה
                אינטרנטית מבוססת בינה מלאכותית ליצירת תוכן ויזואלי – מהווה הסכמה למדיניות זו.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">2. מידע שאנחנו אוספים</h2>
              <p className="mb-4">אנחנו עשויים לאסוף את סוגי המידע הבאים:</p>
              <ul className="list-disc pr-6 space-y-2">
                <li><strong>מידע חשבון:</strong> שם, כתובת אימייל וסיסמה בעת ההרשמה</li>
                <li><strong>מידע שימוש:</strong> נתונים על השימוש בשירות – יצירות, העלאות קבצים, והעדפות</li>
                <li><strong>תוכן שנוצר:</strong> תמונות, טקסטים וקבצים שאתה יוצר או מעלה לשירות</li>
                <li><strong>מידע טכני:</strong> כתובת IP, סוג דפדפן, מערכת הפעלה, ומזהי מכשיר לצורכי אבטחה ותפעול</li>
                <li><strong>עוגיות (Cookies):</strong> קבצים קטנים לשמירת העדפות, התחברות והפעלת הפלטפורמה</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">3. כיצד אנחנו משתמשים במידע</h2>
              <p className="mb-4">אנחנו משתמשים במידע כדי:</p>
              <ul className="list-disc pr-6 space-y-2">
                <li>לספק ולשפר את שירותי קוסם – יצירת תמונות, סרטונים וקרוסלות באמצעות AI</li>
                <li>לאמת זהות ולנהל את חשבונך</li>
                <li>לעבד את הבקשות שלך באמצעות מודלים של בינה מלאכותית</li>
                <li>לשפר את איכות המודלים והשירות (באמצעות נתונים אנונימיים או מצונזרים)</li>
                <li>לשלוח עדכונים, הודעות תחזוקה והנחיות רלוונטיות</li>
                <li>להגן על השירות מפני שימוש לא חוקי או ניצול לרעה</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">4. שיתוף מידע עם צדדים שלישיים</h2>
              <p>
                אנחנו לא מוכרים את המידע האישי שלך. אנחנו עשויים לשתף מידע עם ספקי שירות מהימנים
                (כגון תשתיות ענן, ספקי AI, ומערכות תשלום) הנדרשים להפעלת השירות. ספקים אלה מחויבים
                להגן על המידע ולא להשתמש בו למטרות אחרות. נוכל לחשוף מידע אם נדרש על פי חוק או בהתאם
                להחלטה שיפוטית.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">5. אבטחת מידע</h2>
              <p>
                אנחנו נוקטים אמצעי אבטחה טכנולוגיים וארגוניים להגנה על המידע שלך, לרבות הצפנה,
                גישה מוגבלת ופיקוח שוטף. למרות זאת, אין שיטת העברה באינטרנט שהיא מאה אחוז מאובטחת,
                ואנחנו לא יכולים להבטיח אבטחה מוחלטת.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">6. זכויותיך</h2>
              <p className="mb-4">בהתאם לחוק הגנת הפרטיות ולחוקים ישימים נוספים, יש לך זכות:</p>
              <ul className="list-disc pr-6 space-y-2">
                <li>לגשת למידע האישי שנשמר אודותיך</li>
                <li>לתקן או לעדכן מידע לא מדויק</li>
                <li>לבקש מחיקת המידע האישי שלך (בכפוף לדרישות חוקיות)</li>
                <li>להתנגד לעיבוד מסוים של המידע או לבקש הגבלה</li>
                <li>למשוך את הסכמתך בכל עת</li>
              </ul>
              <p className="mt-4">
                למימוש זכויותיך, פנה אלינו דרך{" "}
                <Link href="/contact" className="text-primary underline hover:no-underline">
                  עמוד הצור קשר
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">7. שמירת מידע</h2>
              <p>
                אנחנו שומרים את המידע כל עוד חשבונך פעיל ולתקופה נוספת כנדרש לצורכי חוק, חשבונאות
                או התגוננות משפטית. לאחר מכן, המידע יימחק או יעובד באופן שיהפוך אותו לבלתי מזוהה.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">8. קטינים</h2>
              <p>
                השירות מיועד למשתמשים בגיל 18 ומעלה. איננו אוספים במודע מידע מקטינים. אם גילית
                שהמידע של קטין הועבר אלינו, אנא פנה אלינו ונפעל להסרתו.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">9. שינויים במדיניות</h2>
              <p>
                אנחנו עשויים לעדכן את מדיניות הפרטיות מעת לעת. שינויים משמעותיים יפורסמו באתר
                ויובאו לידיעתך בחשבונך או באימייל. המשך השימוש לאחר העדכון מהווה הסכמה למדיניות
                המעודכנת.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">10. צור קשר</h2>
              <p>
                לשאלות או הבהרות לגבי מדיניות הפרטיות, ניתן לפנות אלינו דרך{" "}
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
