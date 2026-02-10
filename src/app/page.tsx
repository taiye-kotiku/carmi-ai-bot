import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ExampleCarousel } from "@/components/ExampleCarousel";
import { Film, Image as ImageIcon, Sparkles, Zap, Check, LayoutGrid, Wand2, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950" dir="rtl">
      {/* Enhanced Futuristic Background */}
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950" />
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(rgba(99,102,241,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.05)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="fixed inset-0 -z-10 bg-gradient-to-tr from-cyan-500/5 via-transparent to-purple-500/5" />
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[800px] -z-10 bg-indigo-500/30 rounded-full blur-[150px] animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="fixed bottom-0 right-1/4 w-[600px] h-[600px] -z-10 bg-purple-500/20 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />
      <div className="fixed top-1/3 left-1/4 w-[400px] h-[400px] -z-10 bg-cyan-500/15 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🧙</span>
            <span className="text-xl font-bold text-white">קוסם</span>
          </Link>
          <div className="flex items-center gap-4">
            {user && (
              <>
                <Link href="/generate/carousel" className="text-slate-400 hover:text-white text-sm transition-colors">
                  קרוסלה
                </Link>
                <Link href="/credits" className="text-slate-400 hover:text-white text-sm transition-colors">
                  מנוי וקרדיטים
                </Link>
              </>
            )}
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
          <h1 className="text-6xl md:text-7xl font-bold mb-6 leading-tight text-white">
            <span className="text-5xl md:text-6xl">🧙</span>
            <br />
            קוסם AI
            <br />
            <span className="bg-gradient-to-l from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent animate-pulse" style={{ animationDuration: '3s' }}>
              הפוך רעיונות לתוכן ויזואלי מדהים
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-slate-300 mb-8 max-w-3xl mx-auto leading-relaxed">
            צור תמונות מרהיבות, סרטונים מקצועיים, וקרוסלות מושלמות עם בינה מלאכותית מתקדמת
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

          <div className="flex flex-wrap items-center justify-center gap-6 mt-6 text-sm text-slate-300">
            <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/10">
              <Check className="h-4 w-4 text-emerald-400" />
              <span>ללא כרטיס אשראי</span>
            </div>
            <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/10">
              <Check className="h-4 w-4 text-emerald-400" />
              <span>10 תמונות חינם</span>
            </div>
            <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/10">
              <Check className="h-4 w-4 text-emerald-400" />
              <span>2 המרות רילז</span>
            </div>
          </div>
        </div>
      </section>

      {/* Examples Section */}
      <section id="examples" className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block mb-4 px-4 py-2 bg-indigo-500/10 rounded-full border border-indigo-500/30">
              <span className="text-indigo-300 text-sm font-semibold">✨ יכולות AI מתקדמות</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
              מה אפשר ליצור עם קוסם?
            </h2>
            <p className="text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
              פלטפורמה מקיפה ליצירת תוכן ויזואלי באמצעות בינה מלאכותית מתקדמת
              <br />
              <span className="text-indigo-400 font-semibold">כל הפקודות בעברית!</span>
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {/* Example 1: Text to Image - Astronaut example */}
            <div className="group bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/20 hover:border-purple-400/60 hover:shadow-2xl hover:shadow-purple-500/20 transition-all duration-300 hover:-translate-y-1">
              <div className="h-14 w-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform">
                <ImageIcon className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">יצירת תמונה מטקסט</h3>
              <div className="aspect-square rounded-2xl overflow-hidden mb-4 bg-slate-800/50 relative ring-2 ring-white/10 group-hover:ring-purple-400/50 transition-all">
                <Image
                  src="/examples/astronaut.png"
                  alt="דוגמא: אסטרונאוט בחלל"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 400px"
                />
              </div>
              <p className="text-slate-300 text-sm mb-4 leading-relaxed">
                תאר את התמונה שאתה רוצה בעברית – והבינה המלאכותית תיצור אותה בשבילך תוך שניות
              </p>
              <div className="bg-slate-800/70 rounded-xl p-4 text-sm text-slate-200 border border-purple-500/30 shadow-inner">
                <span className="text-purple-400 font-semibold">דוגמה:</span><br />
                &quot;צור תמונה שלי כאסטרונאוט בחלל עם בניינים מאחוריי&quot;
              </div>
            </div>

            {/* Example 2: Image to Video */}
            <div className="group bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/20 hover:border-cyan-400/60 hover:shadow-2xl hover:shadow-cyan-500/20 transition-all duration-300 hover:-translate-y-1">
              <div className="h-14 w-14 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform">
                <Video className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">יצירת סרטון מתמונה</h3>
              <div className="aspect-square rounded-2xl overflow-hidden mb-4 bg-slate-800/50 ring-2 ring-white/10 group-hover:ring-cyan-400/50 transition-all">
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
              <p className="text-slate-300 text-sm mb-4 leading-relaxed">
                העלה תמונה ותאר את התנועה בעברית – קבל סרטון מקצועי עם אנימציה חיה
              </p>
              <div className="bg-slate-800/70 rounded-xl p-4 text-sm text-slate-200 border border-cyan-500/30 shadow-inner">
                <span className="text-cyan-400 font-semibold">דוגמה:</span><br />
                &quot;תגרום לאסטרונאוט לרחף בחלל באיטיות&quot;
              </div>
            </div>

            {/* Example 3: Character Creation */}
            <div className="group bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/20 hover:border-pink-400/60 hover:shadow-2xl hover:shadow-pink-500/20 transition-all duration-300 hover:-translate-y-1">
              <div className="h-14 w-14 bg-gradient-to-br from-pink-500 to-pink-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform">
                <Sparkles className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">דמות AI אישית</h3>
              <div className="aspect-square rounded-2xl overflow-hidden mb-4 bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center text-6xl ring-2 ring-white/10 group-hover:ring-pink-400/50 transition-all">
                🎭
              </div>
              <p className="text-slate-300 text-sm mb-4 leading-relaxed">
                העלה תמונות שלך ואמן דמות AI – תוכל להשתמש בה בכל תמונה וסרטון שתיצור
              </p>
              <div className="bg-slate-800/70 rounded-xl p-4 text-sm text-slate-200 border border-pink-500/30 shadow-inner">
                <span className="text-pink-400 font-semibold">דוגמה:</span><br />
                &quot;צור תמונה שלי כסופרמן מעל העיר&quot;
              </div>
            </div>

            {/* Example 4: Reel to Carousel */}
            <div className="group bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/20 hover:border-indigo-400/60 hover:shadow-2xl hover:shadow-indigo-500/20 transition-all duration-300 hover:-translate-y-1">
              <div className="h-14 w-14 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform">
                <Film className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">המרת רילז לקרוסלה</h3>
              <div className="aspect-square rounded-2xl overflow-hidden mb-4 bg-gradient-to-br from-indigo-500/20 to-blue-500/20 flex items-center justify-center text-6xl ring-2 ring-white/10 group-hover:ring-indigo-400/50 transition-all">
                🎬
              </div>
              <p className="text-slate-300 text-sm mb-4 leading-relaxed">
                הדבק קישור לרילז מאינסטגרם – AI יבחר את הפריימים הטובים ביותר וייצור 10 תמונות
              </p>
              <div className="bg-slate-800/70 rounded-xl p-4 text-sm text-slate-200 border border-indigo-500/30 shadow-inner">
                <span className="text-indigo-400 font-semibold">דוגמה:</span><br />
                &quot;המר את הרילז הזה לקרוסלה בת 10 תמונות&quot;
              </div>
            </div>

            {/* Example 5: Carousel with branding */}
            <div className="group bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/20 hover:border-emerald-400/60 hover:shadow-2xl hover:shadow-emerald-500/20 transition-all duration-300 hover:-translate-y-1">
              <div className="h-14 w-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform">
                <LayoutGrid className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">קרוסלה עם מיתוג</h3>
              <div className="mb-4 rounded-2xl overflow-hidden ring-2 ring-white/10 group-hover:ring-emerald-400/50 transition-all">
                <ExampleCarousel />
              </div>
              <p className="text-slate-300 text-sm mb-4 leading-relaxed">
                צור קרוסלה עם הלוגו והצבעים של המותג שלך – אוטומטית ובעיצוב אחיד
              </p>
              <div className="bg-slate-800/70 rounded-xl p-4 text-sm text-slate-200 border border-emerald-500/30 shadow-inner">
                <span className="text-emerald-400 font-semibold">דוגמה:</span><br />
                &quot;צור קרוסלה על ליווי משפטי עם הלוגו שלי&quot;
              </div>
            </div>

            {/* Example 6: Cartoonize */}
            <div className="group bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/20 hover:border-amber-400/60 hover:shadow-2xl hover:shadow-amber-500/20 transition-all duration-300 hover:-translate-y-1">
              <div className="h-14 w-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform">
                <Wand2 className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">המרה לקריקטורה</h3>
              <div className="aspect-square rounded-2xl overflow-hidden mb-4 bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center text-6xl ring-2 ring-white/10 group-hover:ring-amber-400/50 transition-all">
                🎨
              </div>
              <p className="text-slate-300 text-sm mb-4 leading-relaxed">
                העלה תמונה והפוך אותה לקריקטורה צבעונית בסגנון איור דיגיטלי מקצועי
              </p>
              <div className="bg-slate-800/70 rounded-xl p-4 text-sm text-slate-200 border border-amber-500/30 shadow-inner">
                <span className="text-amber-400 font-semibold">טיפ:</span><br />
                מומלץ תמונה עם פנים ברורים ותאורה טובה
              </div>
            </div>
          </div>

          <div className="text-center mt-16">
            <div className="inline-flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="text-lg px-10 h-16 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0 shadow-2xl shadow-indigo-500/50" asChild>
                <Link href="/signup">
                  <Wand2 className="h-6 w-6 ml-2" />
                  התחל ליצור בחינם
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-10 h-16 border-2 border-indigo-400/50 text-indigo-300 hover:bg-indigo-500/20 hover:border-indigo-400" asChild>
                <Link href="#features">
                  <Sparkles className="h-6 w-6 ml-2" />
                  גלה את היכולות
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
              למה לבחור בקוסם AI?
            </h2>
            <p className="text-xl text-slate-300 max-w-3xl mx-auto">
              פלטפורמה מקיפה עם כלים מתקדמים ליצירת תוכן ויזואלי
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="group bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md p-8 rounded-3xl border border-white/20 hover:border-indigo-400/60 hover:shadow-2xl hover:shadow-indigo-500/20 transition-all duration-300 hover:-translate-y-1">
              <div className="h-16 w-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform">
                <Film className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-white">המרת רילז לקרוסלה</h3>
              <p className="text-slate-300 leading-relaxed">
                הדבק קישור לרילז מאינסטגרם וקבל 10 תמונות מושלמות לקרוסלה.
                AI חכם בוחר את הפריימים הכי מוצלחים אוטומטית.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md p-8 rounded-3xl border border-white/20 hover:border-purple-400/60 hover:shadow-2xl hover:shadow-purple-500/20 transition-all duration-300 hover:-translate-y-1">
              <div className="h-16 w-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform">
                <ImageIcon className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-white">יצירת תמונות מתקדמת</h3>
              <p className="text-slate-300 leading-relaxed">
                תאר את התמונה שאתה רוצה בעברית והבינה המלאכותית תיצור אותה בשבילך.
                תמיכה מלאה בהוראות בשפה העברית.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md p-8 rounded-3xl border border-white/20 hover:border-emerald-400/60 hover:shadow-2xl hover:shadow-emerald-500/20 transition-all duration-300 hover:-translate-y-1">
              <div className="h-16 w-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-white">מיתוג אוטומטי</h3>
              <p className="text-slate-300 leading-relaxed">
                הוסף את הלוגו שלך לכל תמונה באופן אוטומטי.
                בחר מיקום, גודל ושקיפות – הכל בקליק.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="group bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md p-8 rounded-3xl border border-white/20 hover:border-cyan-400/60 hover:shadow-2xl hover:shadow-cyan-500/20 transition-all duration-300 hover:-translate-y-1">
              <div className="h-16 w-16 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform">
                <Video className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-white">סרטונים מקצועיים</h3>
              <p className="text-slate-300 leading-relaxed">
                צור סרטונים מתמונות או מטקסט בלבד.
                AI מתקדם מייצר סרטונים איכוסיים בשניות.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="group bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md p-8 rounded-3xl border border-white/20 hover:border-pink-400/60 hover:shadow-2xl hover:shadow-pink-500/20 transition-all duration-300 hover:-translate-y-1">
              <div className="h-16 w-16 bg-gradient-to-br from-pink-500 to-pink-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform">
                <Zap className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-white">דמות AI אישית</h3>
              <p className="text-slate-300 leading-relaxed">
                העלה תמונות שלך ואמן דמות AI.
                השתמש בדמות בכל תמונה וסרטון עתידי.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="group bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md p-8 rounded-3xl border border-white/20 hover:border-amber-400/60 hover:shadow-2xl hover:shadow-amber-500/20 transition-all duration-300 hover:-translate-y-1">
              <div className="h-16 w-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform">
                <Wand2 className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-white">אפקטים יצירתיים</h3>
              <p className="text-slate-300 leading-relaxed">
                המר תמונות לקריקטורות, שנה סגנונות, וערוך בקלות.
                כלים מקצועיים בממשק פשוט.
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