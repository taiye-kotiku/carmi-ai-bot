import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ExampleCarousel } from "@/components/ExampleCarousel";
import { Film, Image as ImageIcon, Sparkles, Zap, Check, LayoutGrid, Wand2, Video } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950" dir="rtl">
      {/* Futuristic Background */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-slate-950 via-indigo-950/50 to-slate-950" />
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
      <div className="fixed inset-0 -z-10 bg-gradient-to-t from-indigo-500/10 via-transparent to-cyan-500/10" />
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] -z-10 bg-indigo-500/20 rounded-full blur-[128px]" />
      <div className="fixed bottom-0 right-1/4 w-[400px] h-[400px] -z-10 bg-cyan-500/10 rounded-full blur-[100px]" />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🧙</span>
            <span className="text-xl font-bold text-white">קוסם</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/carousel-test" className="text-slate-400 hover:text-white text-sm transition-colors">
              בדיקת קרוסלה
            </Link>
            <Link href="/brand" className="text-slate-400 hover:text-white text-sm transition-colors">
              מיתוג
            </Link>
            <Link href="/credits" className="text-slate-400 hover:text-white text-sm transition-colors">
              מנוי וקרדיטים
            </Link>
            <Link href="#examples" className="text-slate-400 hover:text-white text-sm transition-colors">
              דוגמאות
            </Link>
            <Link href="/terms" className="text-slate-400 hover:text-white text-sm transition-colors">
              תנאי שימוש
            </Link>
            <Link href="/contact" className="text-slate-400 hover:text-white text-sm transition-colors">
              צור קשר
            </Link>
            <Button variant="ghost" className="text-slate-400 hover:text-white hover:bg-white/10" asChild>
              <Link href="/login">התחברות</Link>
            </Button>
            <Button className="bg-indigo-500 hover:bg-indigo-600 text-white border-0" asChild>
              <Link href="/signup">התחל בחינם</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight text-white">
            קוסם
            <br />
            <span className="bg-gradient-to-l from-indigo-400 to-cyan-400 bg-clip-text text-transparent">הפוך רעיונות לתוכן ויזואלי</span>
          </h1>

          <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
            צור תמונות, סרטונים, קרוסלות
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="text-lg px-8 h-14 bg-indigo-500 hover:bg-indigo-600 text-white border-0" asChild>
              <Link href="/signup">
                <Zap className="h-5 w-5 ml-2" />
                התחל בחינם
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 h-14 border-indigo-500/50 text-indigo-300 hover:bg-indigo-500/20 hover:text-white" asChild>
              <Link href="#examples">
                דוגמאות
              </Link>
            </Button>
          </div>

          <p className="text-sm text-slate-500 mt-4">
            ✓ ללא כרטיס אשראי  ✓ 10 תמונות חינם  ✓ 2 המרות רילז
          </p>
        </div>
      </section>

      {/* Examples Section */}
      <section id="examples" className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4 text-white">דוגמאות לשימוש</h2>
          <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
            ראה איך קוסם עוזר ליצור תוכן מקצועי בקלות
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Example 1: Text to Image - Astronaut example */}
            <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 hover:border-indigo-500/50 transition-all">
              <div className="h-12 w-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4">
                <ImageIcon className="h-6 w-6 text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-white">יצירת תמונה מטקסט</h3>
              <div className="aspect-square rounded-xl overflow-hidden mb-4 bg-slate-800/50 relative">
                <Image
                  src="/examples/astronaut.png"
                  alt="דוגמא: אסטרונאוט בחלל"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 400px"
                />
              </div>
              <p className="text-slate-400 text-sm mb-4">
                תאר את התמונה שאתה רוצה – והבוט ייצור אותה בשבילך.
              </p>
              <div className="bg-slate-800/50 rounded-lg p-3 text-sm text-slate-300 font-mono border border-white/5">
                &quot;צור תמונה שלי כאסטרונאוט בחלל עם בניינים מאחוריי&quot;
              </div>
            </div>

            {/* Example 2: Image to Video */}
            <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 hover:border-indigo-500/50 transition-all">
              <div className="h-12 w-12 bg-cyan-500/20 rounded-xl flex items-center justify-center mb-4">
                <Video className="h-6 w-6 text-cyan-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-white">יצירת סרטון מתמונה</h3>
              <div className="aspect-square rounded-xl overflow-hidden mb-4 bg-slate-800/50">
                <video
                  src="/examples/astronaut-video.mp4"
                  poster="/examples/astronaut.png"
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                  loop
                  autoPlay
                />
              </div>
              <p className="text-slate-400 text-sm mb-4">
                העלה תמונה ובחר את התנועה – וקבל סרטון חי.
              </p>
              <div className="bg-slate-800/50 rounded-lg p-3 text-sm text-slate-300 font-mono border border-white/5">
                &quot;תגרום לאסטרונאוט לרחף בחלל&quot;
              </div>
            </div>

            {/* Example 3: Reel to Carousel */}
            <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 hover:border-indigo-500/50 transition-all">
              <div className="h-12 w-12 bg-indigo-500/20 rounded-xl flex items-center justify-center mb-4">
                <Film className="h-6 w-6 text-indigo-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-white">המרת רילז לקרוסלה</h3>
              <p className="text-slate-400 text-sm mb-4">
                הדבק קישור לרילז מאינסטגרם – הבוט יבחר את הפריימים הטובים ביותר וייצור 10 תמונות מוכנות לפוסט.
              </p>
              <div className="bg-slate-800/50 rounded-lg p-3 text-sm text-slate-300 font-mono border border-white/5">
                &quot;המר את הרילז הזה לקרוסלה&quot;
              </div>
            </div>

            {/* Example 4: Carousel with branding */}
            <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 hover:border-indigo-500/50 transition-all">
              <div className="h-12 w-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-4">
                <LayoutGrid className="h-6 w-6 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-white">קרוסלה עם לוגו אישי</h3>
              <div className="mb-4">
                <ExampleCarousel />
              </div>
              <p className="text-slate-400 text-sm mb-4">
                צור סדרת תמונות עם הלוגו והצבעים של המותג שלך – אוטומטית ובלוח אחיד.
              </p>
              <div className="bg-slate-800/50 rounded-lg p-3 text-sm text-slate-300 font-mono border border-white/5">
                &quot;צור קרוסלה עם הלוגו שלי על ליווי משפטי בתהליך התחדשות עירונית&quot;
              </div>
            </div>
          </div>

          <div className="text-center mt-12">
            <Button size="lg" className="bg-indigo-500 hover:bg-indigo-600 text-white border-0" asChild>
              <Link href="/signup">
                <Wand2 className="h-5 w-5 ml-2" />
                נסה עכשיו בחינם
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-white">
            כל מה שצריך ליצירת תוכן מקצועי
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white/5 backdrop-blur-sm p-8 rounded-2xl border border-white/10 hover:border-indigo-500/30 transition-all">
              <div className="h-12 w-12 bg-indigo-500/20 rounded-xl flex items-center justify-center mb-4">
                <Film className="h-6 w-6 text-indigo-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-white">המרת רילז לקרוסלה</h3>
              <p className="text-slate-400">
                הדבק קישור לרילז מאינסטגרם וקבל 10 תמונות מושלמות לקרוסלה.
                הAI בוחר את הפריימים הטובים ביותר.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white/5 backdrop-blur-sm p-8 rounded-2xl border border-white/10 hover:border-indigo-500/30 transition-all">
              <div className="h-12 w-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4">
                <ImageIcon className="h-6 w-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-white">יצירת תמונות עם AI</h3>
              <p className="text-slate-400">
                תאר את התמונה שאתה רוצה והבינה המלאכותית תיצור אותה.
                תומך בעברית ובאנגלית.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white/5 backdrop-blur-sm p-8 rounded-2xl border border-white/10 hover:border-indigo-500/30 transition-all">
              <div className="h-12 w-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-4">
                <Sparkles className="h-6 w-6 text-emerald-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-white">מיתוג אוטומטי</h3>
              <p className="text-slate-400">
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
          <h2 className="text-3xl font-bold text-center mb-4 text-white">תמחור פשוט</h2>
          <p className="text-slate-400 text-center mb-12">
            התחל בחינם, שדרג כשצריך
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Free Plan */}
            <div className="bg-white/5 backdrop-blur-sm p-8 rounded-2xl border border-white/10">
              <h3 className="text-lg font-semibold mb-2 text-white">חינם</h3>
              <div className="mb-4">
                <span className="text-4xl font-bold text-white">₪0</span>
                <span className="text-slate-400">/חודש</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-slate-300">
                  <Check className="h-5 w-5 text-emerald-400" />
                  <span>10 יצירות תמונה</span>
                </li>
                <li className="flex items-center gap-2 text-slate-300">
                  <Check className="h-5 w-5 text-emerald-400" />
                  <span>2 המרות רילז</span>
                </li>
                <li className="flex items-center gap-2 text-slate-300">
                  <Check className="h-5 w-5 text-emerald-400" />
                  <span>5 קרוסלות</span>
                </li>
              </ul>
              <Button variant="outline" className="w-full border-indigo-500/50 text-indigo-300 hover:bg-indigo-500/20" asChild>
                <Link href="/signup">
                  התחל בחינם
                </Link>
              </Button>
            </div>

            {/* Starter Plan */}
            <div className="bg-indigo-500/20 backdrop-blur-sm p-8 rounded-2xl relative border-2 border-indigo-500/50">
              <div className="absolute -top-3 right-4 bg-amber-400 text-amber-950 text-xs font-medium px-3 py-1 rounded-full">
                הכי פופולרי
              </div>
              <h3 className="text-lg font-semibold mb-2 text-white">סטארטר</h3>
              <div className="mb-4">
                <span className="text-4xl font-bold text-white">₪139</span>
                <span className="text-indigo-200/80">/חודש</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-indigo-100">
                  <Check className="h-5 w-5 text-emerald-400" />
                  <span>250 מודעות / תמונות בחודש</span>
                </li>
                <li className="flex items-center gap-2 text-indigo-100">
                  <Check className="h-5 w-5 text-emerald-400" />
                  <span>20 קרוסלות מותאמות</span>
                </li>
                <li className="flex items-center gap-2 text-indigo-100">
                  <Check className="h-5 w-5 text-emerald-400" />
                  <span>סוכן קופירייטר מקצועי</span>
                </li>
                <li className="flex items-center gap-2 text-indigo-100">
                  <Check className="h-5 w-5 text-emerald-400" />
                  <span>מחולל תמונות יצירתי ומתקדם</span>
                </li>
                <li className="flex items-center gap-2 text-indigo-100">
                  <Check className="h-5 w-5 text-emerald-400" />
                  <span>יצירת תוכן מותאם אישית</span>
                </li>
                <li className="flex items-center gap-2 text-indigo-100">
                  <Check className="h-5 w-5 text-emerald-400" />
                  <span>עריכת תמונות עם AI</span>
                </li>
                <li className="flex items-center gap-2 text-indigo-100">
                  <Check className="h-5 w-5 text-emerald-400" />
                  <span>יצירת סרטונים עם הדמות שלך</span>
                </li>
                <li className="flex items-center gap-2 text-indigo-100">
                  <Check className="h-5 w-5 text-emerald-400" />
                  <span>דמות ראשונה בחינם</span>
                </li>
              </ul>
              <Button className="w-full bg-indigo-500 hover:bg-indigo-600 text-white border-0" asChild>
                <Link href="/signup?plan=starter">
                  בחר בתוכנית
                </Link>
              </Button>
            </div>

            {/* Pro Plan */}
            <div className="bg-white/5 backdrop-blur-sm p-8 rounded-2xl border border-white/10">
              <h3 className="text-lg font-semibold mb-2 text-white">יוצר תוכן מקצועי</h3>
              <div className="mb-4">
                <span className="text-4xl font-bold text-white">₪229</span>
                <span className="text-slate-400">/חודש</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-slate-300">
                  <Check className="h-5 w-5 text-emerald-400" />
                  <span>500 מודעות / תמונות בחודש</span>
                </li>
                <li className="flex items-center gap-2 text-slate-300">
                  <Check className="h-5 w-5 text-emerald-400" />
                  <span>50 קרוסלות מותאמות</span>
                </li>
                <li className="flex items-center gap-2 text-slate-300">
                  <Check className="h-5 w-5 text-emerald-400" />
                  <span>סוכן קופירייטר מקצועי</span>
                </li>
                <li className="flex items-center gap-2 text-slate-300">
                  <Check className="h-5 w-5 text-emerald-400" />
                  <span>מחולל תמונות יצירתי ומתקדם</span>
                </li>
                <li className="flex items-center gap-2 text-slate-300">
                  <Check className="h-5 w-5 text-emerald-400" />
                  <span>יצירת תוכן מותאם אישית</span>
                </li>
                <li className="flex items-center gap-2 text-slate-300">
                  <Check className="h-5 w-5 text-emerald-400" />
                  <span>עריכת תמונות עם AI</span>
                </li>
                <li className="flex items-center gap-2 text-slate-300">
                  <Check className="h-5 w-5 text-emerald-400" />
                  <span>יצירת סרטונים מקצועיים עם הדמות שלך</span>
                </li>
                <li className="flex items-center gap-2 text-slate-300">
                  <Check className="h-5 w-5 text-emerald-400" />
                  <span>2 דמויות ראשונות בחינם</span>
                </li>
              </ul>
              <Button variant="outline" className="w-full border-indigo-500/50 text-indigo-300 hover:bg-indigo-500/20" asChild>
                <Link href="/signup?plan=pro">
                  בחר בתוכנית
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-2xl">🧙</span>
            <span className="text-xl font-bold text-white">קוסם</span>
          </div>
          <p className="text-slate-400 mb-8">
            פלטפורמה מבוססת AI ליצירת תוכן ויזואלי
          </p>
          <div className="flex items-center justify-center gap-6 text-slate-400">
            <Link href="/terms" className="hover:text-white transition-colors">תנאי שימוש</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">פרטיות</Link>
            <Link href="/contact" className="hover:text-white transition-colors">צור קשר</Link>
          </div>
          <p className="text-slate-500 text-sm mt-8">
            © 2025 קוסם. כל הזכויות שמורות.
          </p>
        </div>
      </footer>
    </div>
  );
}