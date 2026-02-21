import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import {
  Sparkles,
  Film,
  Images,
  Zap,
  Wand2,
  Video,
  Check,
  ArrowLeft,
  Play,
  User,
  PenLine,
  Star,
  LayoutGrid,
  Instagram,
  TrendingUp,
  Clock,
  Target,
  Palette,
  MousePointerClick,
  ChevronDown,
  Quote,
  Megaphone,
  ShoppingBag,
  Camera,
  BookOpen,
  Scissors,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ctaHref = user ? "/dashboard" : "/signup";
  const ctaText = user ? "הכנס למערכת" : "התחל בחינם";

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-50 selection:bg-indigo-500/30"
      dir="rtl"
    >
      {/* Background Effects */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-purple-600/15 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-indigo-600/15 rounded-full blur-[100px]" />
      </div>

      {/* ─── HEADER ─── */}
      <header className="fixed top-0 w-full z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg sm:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              kossem AI
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
            <Link
              href="#use-cases"
              className="hover:text-white transition-colors"
            >
              שימושים
            </Link>
            <Link
              href="#features"
              className="hover:text-white transition-colors"
            >
              יכולות
            </Link>
            <Link
              href="#how-it-works"
              className="hover:text-white transition-colors"
            >
              איך זה עובד
            </Link>
            <Link
              href="#pricing"
              className="hover:text-white transition-colors"
            >
              מחירים
            </Link>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <Button
                asChild
                variant="outline"
                className="border-indigo-500/50 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 hover:text-indigo-200 text-sm"
              >
                <Link href="/dashboard">
                  הכנס למערכת
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-slate-400 hover:text-white hidden sm:block transition-colors"
                >
                  התחברות
                </Link>
                <Button
                  asChild
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 border-0 shadow-lg shadow-indigo-500/20 text-sm"
                >
                  <Link href="/signup">
                    התחל בחינם
                    <Sparkles className="mr-1.5 h-4 w-4" />
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section className="relative pt-28 pb-8 sm:pt-36 sm:pb-12 md:pt-44 md:pb-16 overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <Badge
              variant="outline"
              className="mb-5 sm:mb-6 border-indigo-500/30 bg-indigo-500/10 text-indigo-300 px-4 py-1.5 text-xs sm:text-sm backdrop-blur-md"
            >
              <Instagram className="h-3.5 w-3.5 ml-1.5 inline" />
              הכלי שבעלי מותג באינסטגרם חיכו לו
            </Badge>

            <h1 className="text-3xl sm:text-5xl md:text-7xl font-extrabold tracking-tight mb-5 sm:mb-8 leading-[1.1]">
              תוכן שעוצר גלילה.
              <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-l from-indigo-400 via-purple-400 to-pink-400">
                בלחיצה אחת.
              </span>
            </h1>

            <p className="text-base sm:text-xl text-slate-400 max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed">
              תמונות פוטוריאליסטיות, סרטוני רילז, קרוסלות מידע וסטוריז
              מעוצבים &mdash; הכל נוצר מתיאור בעברית. בלי מעצב, בלי צלם, בלי
              לחכות.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Button
                size="lg"
                className="w-full sm:w-auto h-13 sm:h-14 px-8 text-base sm:text-lg bg-white text-slate-900 hover:bg-slate-200 border-0 shadow-xl shadow-white/10 font-bold"
                asChild
              >
                <Link href={ctaHref}>
                  <Zap className="ml-2 h-5 w-5" />
                  {user ? "המשך ליצור" : "נסה בחינם - 10 תמונות מתנה"}
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto h-13 sm:h-14 px-8 text-base sm:text-lg border-white/20 bg-white/5 text-white hover:bg-white/10 backdrop-blur-sm"
                asChild
              >
                <Link href="#gallery">
                  <Play className="ml-2 h-5 w-5" />
                  ראה דוגמאות
                </Link>
              </Button>
            </div>

            <div className="mt-8 sm:mt-10 flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-500" /> ללא כרטיס
                אשראי
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-500" /> תמיכה מלאה
                בעברית
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-500" /> תוצאות תוך
                שניות
              </span>
            </div>
          </div>

          {/* Hero media showcase */}
          <div className="mt-12 sm:mt-16 max-w-5xl mx-auto">
            <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-white/10 bg-slate-900/50 shadow-2xl shadow-indigo-500/10">
              <div className="grid grid-cols-3 gap-0">
                <div className="relative aspect-[9/16] border-r border-white/10 overflow-hidden">
                  <Image
                    src="/examples/caricature.png"
                    alt="קריקטורה מותאמת אישית"
                    fill
                    className="object-cover"
                    sizes="33vw"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                  <div className="absolute bottom-3 right-3 left-3 sm:bottom-4 sm:right-4">
                    <Badge className="bg-pink-500/90 text-white border-0 text-[10px] sm:text-xs">
                      קריקטורה AI
                    </Badge>
                  </div>
                </div>
                <div className="relative aspect-[9/16] border-r border-white/10 overflow-hidden">
                  <video
                    src="/examples/video.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                  <div className="absolute bottom-3 right-3 left-3 sm:bottom-4 sm:right-4">
                    <Badge className="bg-amber-500/90 text-white border-0 text-[10px] sm:text-xs">
                      <Video className="h-3 w-3 ml-1" />
                      וידאו AI
                    </Badge>
                  </div>
                </div>
                <div className="relative aspect-[9/16] overflow-hidden">
                  <Image
                    src="/examples/advanced-image-generator.png"
                    alt="תמונה פוטוריאליסטית"
                    fill
                    className="object-cover"
                    sizes="33vw"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                  <div className="absolute bottom-3 right-3 left-3 sm:bottom-4 sm:right-4">
                    <Badge className="bg-indigo-500/90 text-white border-0 text-[10px] sm:text-xs">
                      <Sparkles className="h-3 w-3 ml-1" />
                      תמונת AI
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-white/20 backdrop-blur-xl flex items-center justify-center border border-white/30 shadow-2xl">
                  <Sparkles className="h-7 w-7 sm:h-9 sm:w-9 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── STATS BAR ─── */}
      <section className="py-10 sm:py-14 border-y border-white/5 bg-slate-900/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center">
            {[
              { value: "10,000+", label: "בעלי מותג משתמשים" },
              { value: "50,000+", label: "תמונות נוצרו החודש" },
              { value: "5,000+", label: "סרטוני רילז נוצרו" },
              { value: "98%", label: "שביעות רצון" },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-2xl sm:text-4xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400">
                  {s.value}
                </div>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── USE CASES FOR INSTAGRAM ─── */}
      <section id="use-cases" className="py-16 sm:py-24 relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 sm:mb-16">
            <Badge
              variant="outline"
              className="mb-4 border-pink-500/30 bg-pink-500/10 text-pink-300 text-xs sm:text-sm px-4 py-1"
            >
              <Instagram className="h-3.5 w-3.5 ml-1.5 inline" />
              מותאם לאינסטגרם
            </Badge>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-4">
              כל סוג תוכן.
              <br className="sm:hidden" />{" "}
              <span className="text-purple-400">פלטפורמה אחת.</span>
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-lg">
              בין אם אתה מנהל מותג, משפיען או בעל עסק &mdash; הנה מה שתוכל
              ליצור
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[
              {
                icon: Camera,
                color: "indigo",
                title: "פוסטים לפיד",
                desc: "תמונות מקצועיות בהתאמה אישית. פוטוריאליסטיות, אמנותיות או ממותגות - הכל מתיאור טקסט.",
                tag: "הכי פופולרי",
              },
              {
                icon: Images,
                color: "emerald",
                title: "קרוסלות מידע",
                desc: "קרוסלות שקופיות עם מיתוג, לוגו ותוכן אוטומטי. מושלם לטיפים, מדריכים ופוסטים חינוכיים.",
                tag: null,
              },
              {
                icon: Video,
                color: "amber",
                title: "רילז ווידאו",
                desc: "סרטוני 8-15 שניות באיכות קולנועית. תנועה, אודיו ואפקטים - מטקסט או מתמונה.",
                tag: null,
              },
              {
                icon: BookOpen,
                color: "pink",
                title: "סטוריז",
                desc: "4 תמונות אנכיות + וידאו לסטורי שלם. מוכן להעלאה ישירה לאינסטגרם.",
                tag: "חדש",
              },
              {
                icon: PenLine,
                color: "purple",
                title: "עריכת תמונות",
                desc: "העלה תמונת מוצר ותגיד ל-AI מה לשנות. רקע חדש, סגנון אחר, טקסט - הכל.",
                tag: null,
              },
              {
                icon: User,
                color: "cyan",
                title: "אווטאר AI אישי",
                desc: "אמן את ה-AI על הפנים שלך. צור תמונות בכיכובך בכל סגנון - עסקי, קומיקס, שיווקי.",
                tag: null,
              },
            ].map((item) => (
              <div
                key={item.title}
                className="group relative p-5 sm:p-7 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-white/20 transition-all duration-300"
              >
                {item.tag && (
                  <div className="absolute top-4 left-4 sm:top-5 sm:left-5">
                    <span
                      className={`text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-full ${item.tag === "חדש" ? "bg-pink-500/20 text-pink-300 border border-pink-500/30" : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"}`}
                    >
                      {item.tag}
                    </span>
                  </div>
                )}
                <div
                  className={`h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-${item.color}-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
                >
                  <item.icon
                    className={`h-5 w-5 sm:h-6 sm:w-6 text-${item.color}-400`}
                  />
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-2">
                  {item.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="text-center mt-10 sm:mt-14">
            <Button
              size="lg"
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 border-0 shadow-lg shadow-indigo-500/20 h-13 px-8 text-base font-bold"
              asChild
            >
              <Link href={ctaHref}>
                <Sparkles className="ml-2 h-5 w-5" />
                {ctaText}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ─── WHY KOSSEM ─── */}
      <section className="py-16 sm:py-24 bg-slate-900/40 border-y border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-4">
              למה בעלי מותג עוברים ל-kossem?
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto text-sm sm:text-base">
              6 סיבות שמשנות את כללי המשחק
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[
              {
                icon: TrendingUp,
                title: "CTR גבוה ב-40%",
                desc: "תמונות AI פוטוריאליסטיות מקבלות הרבה יותר קליקים ממודעות סטוק רגילות.",
              },
              {
                icon: Clock,
                title: "חוסך 10+ שעות בשבוע",
                desc: "במקום לחכות למעצב - כתוב תיאור וקבל תוכן מוכן תוך שניות.",
              },
              {
                icon: Target,
                title: "קליקים יותר זולים",
                desc: "תמונות ייחודיות = CPM נמוך יותר. אלגוריתם Meta מעדיף תוכן מקורי.",
              },
              {
                icon: Palette,
                title: "מיתוג עקבי",
                desc: "לוגו, צבעי מותג וטון דיבור אחיד בכל קרוסלה וסטורי שאתה יוצר.",
              },
              {
                icon: MousePointerClick,
                title: "בלי ללמוד פוטושופ",
                desc: "ממשק בעברית, אינטואיטיבי לחלוטין. כתוב מה אתה רוצה וה-AI יעשה את השאר.",
              },
              {
                icon: Zap,
                title: "התחלה מיידית",
                desc: "מייל ואתה בפנים. 10 תמונות מתנה. אפס התחייבות, ביטול בלחיצה אחת.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="group flex gap-4 p-5 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/15 transition-all duration-300"
              >
                <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-500/20 transition-colors">
                  <item.icon className="h-5 w-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg mb-1">
                    {item.title}
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES SHOWCASE ─── */}
      <section id="features" className="py-16 sm:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-4">
              ארגז הכלים המלא שלך
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-lg">
              כל מה שצריך כדי ליצור תוכן מנצח לאינסטגרם &mdash; בממשק אחד
              חכם
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Creative Hub */}
            <div className="md:col-span-2 group relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-purple-900/30 to-indigo-900/30 border border-purple-500/20 hover:border-purple-500/40 transition-all duration-500 min-h-[280px] sm:min-h-[360px]">
              <div className="absolute inset-0 z-0">
                <Image
                  src="/examples/caricature.png"
                  alt="מרכז יצירתי"
                  fill
                  className="object-cover opacity-30 group-hover:opacity-40 group-hover:scale-105 transition-all duration-700"
                  sizes="100vw"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/60 to-transparent z-10" />
              <div className="relative z-20 p-7 sm:p-10 h-full flex flex-col justify-center max-w-xl">
                <Badge className="w-fit mb-4 bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  <Sparkles className="h-3 w-3 ml-1" />
                  הפיצ&apos;ר הכוכב
                </Badge>
                <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3">
                  מרכז יצירתי
                </h3>
                <p className="text-slate-300 text-sm sm:text-base mb-6 leading-relaxed">
                  כתוב תיאור אחד וקבל הכל במקביל: תמונה, קרוסלה, וידאו
                  וסטורי. כל סוג תוכן נוצר בו-זמנית, חוסך לך שעות של עבודה.
                </p>
                <Button
                  className="w-fit bg-purple-600 hover:bg-purple-500 text-white border-0"
                  asChild
                >
                  <Link href={user ? "/generate/creative-hub" : "/signup"}>
                    <LayoutGrid className="ml-2 h-4 w-4" />
                    נסה את המרכז היצירתי
                  </Link>
                </Button>
              </div>
            </div>

            {/* Image Generator */}
            <div className="group relative overflow-hidden rounded-2xl sm:rounded-3xl bg-slate-900/50 border border-white/10 hover:border-indigo-500/40 transition-all duration-500 min-h-[300px] sm:min-h-[380px]">
              <div className="absolute inset-0 z-0">
                <Image
                  src="/examples/advanced-image-generator.png"
                  alt="מחולל תמונות"
                  fill
                  className="object-cover opacity-50 group-hover:opacity-65 group-hover:scale-105 transition-all duration-700"
                  sizes="50vw"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent z-10" />
              <div className="relative z-20 p-6 sm:p-8 h-full flex flex-col justify-end">
                <div className="h-11 w-11 rounded-xl bg-indigo-500/20 flex items-center justify-center mb-3 backdrop-blur-md">
                  <Sparkles className="h-5 w-5 text-indigo-400" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold mb-2">
                  מחולל תמונות מתקדם
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed mb-4">
                  כתוב מה אתה מדמיין &mdash; וקבל תמונה פוטוריאליסטית תוך
                  שניות. המנוע מבין עברית בצורה מושלמת.
                </p>
                <Button variant="secondary" className="w-fit" asChild>
                  <Link href={user ? "/generate/image" : "/signup"}>
                    נסה עכשיו
                  </Link>
                </Button>
              </div>
            </div>

            {/* Video */}
            <div className="group relative overflow-hidden rounded-2xl sm:rounded-3xl bg-slate-900/50 border border-white/10 hover:border-amber-500/40 transition-all duration-500 min-h-[300px] sm:min-h-[380px]">
              <div className="absolute inset-0 z-0">
                <video
                  src="/examples/video.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-500"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent z-10" />
              <div className="relative z-20 p-6 sm:p-8 h-full flex flex-col justify-end">
                <div className="h-11 w-11 rounded-xl bg-amber-500/20 flex items-center justify-center mb-3 backdrop-blur-md">
                  <Video className="h-5 w-5 text-amber-400" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold mb-2">
                  טקסט לוידאו
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed mb-4">
                  סרטוני 8-15 שניות באיכות קולנועית עם אודיו. מתמונה או
                  מטקסט. מושלם לרילז ולסטוריז.
                </p>
                <Button variant="secondary" className="w-fit" asChild>
                  <Link href={user ? "/generate/text-to-video" : "/signup"}>
                    נסה עכשיו
                  </Link>
                </Button>
              </div>
            </div>

            {/* Carousels */}
            <div className="group relative overflow-hidden rounded-2xl sm:rounded-3xl bg-slate-900/50 border border-white/10 hover:border-emerald-500/40 transition-all duration-500 p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <div>
                  <div className="h-11 w-11 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-3">
                    <Images className="h-5 w-5 text-emerald-400" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold mb-2">
                    קרוסלות ממותגות
                  </h3>
                  <p className="text-slate-300 text-sm leading-relaxed mb-4">
                    תוכן + עיצוב + לוגו &mdash; הכל אוטומטי. הזן נושא וקבל
                    קרוסלה מוכנה לפרסום עם 5-10 שקופיות מעוצבות.
                  </p>
                  <Button variant="secondary" className="w-fit" asChild>
                    <Link href={user ? "/generate/carousel" : "/signup"}>
                      נסה עכשיו
                    </Link>
                  </Button>
                </div>
                <div className="hidden sm:flex gap-2 flex-shrink-0">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className={`w-20 h-28 rounded-lg bg-emerald-500/10 border border-emerald-500/20 ${i === 2 ? "rotate-3" : "-rotate-2"} group-hover:rotate-0 transition-transform duration-300`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Image Editing */}
            <div className="group relative overflow-hidden rounded-2xl sm:rounded-3xl bg-slate-900/50 border border-white/10 hover:border-purple-500/40 transition-all duration-500 min-h-[220px]">
              <div className="absolute inset-0 z-0 flex">
                {[
                  "/examples/image-edit-1.png",
                  "/examples/image-edit-2.png",
                  "/examples/image-edit-3.png",
                ].map((src, i) => (
                  <div key={i} className="flex-1 relative">
                    <Image
                      src={src}
                      alt={`עריכה ${i + 1}`}
                      fill
                      className="object-cover opacity-40 group-hover:opacity-55 transition-opacity duration-500"
                      sizes="33vw"
                    />
                  </div>
                ))}
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/50 to-transparent z-10" />
              <div className="relative z-20 p-6 sm:p-8 h-full flex flex-col justify-end">
                <div className="h-11 w-11 rounded-xl bg-purple-500/20 flex items-center justify-center mb-3 backdrop-blur-md">
                  <PenLine className="h-5 w-5 text-purple-400" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold mb-2">
                  עריכת תמונות AI
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  העלה תמונת מוצר ותגיד מה לשנות &mdash; רקע, סגנון, סביבה.
                  ה-AI מבצע את העריכה בשבילך.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section
        id="how-it-works"
        className="py-16 sm:py-24 bg-slate-900/40 border-y border-white/5"
      >
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 sm:mb-16">
            <Badge
              variant="outline"
              className="mb-4 border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs sm:text-sm px-4 py-1"
            >
              שלושה צעדים
            </Badge>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-4">
              איך זה עובד?
            </h2>
            <p className="text-slate-400 text-sm sm:text-lg">
              מרעיון לתוכן מוכן - ב-60 שניות
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 sm:gap-8 max-w-4xl mx-auto">
            {[
              {
                step: "01",
                title: "תאר מה אתה רוצה",
                desc: 'כתוב תיאור בעברית. לדוגמה: "קפה לאטה אלגנטי בבוקר שמשי עם עלה על הקצף". ככל שהתיאור מפורט יותר, התוצאה טובה יותר.',
                icon: PenLine,
              },
              {
                step: "02",
                title: "בחר סוג תוכן",
                desc: "תמונה? קרוסלה? וידאו? סטורי? או הכל ביחד דרך המרכז היצירתי. ה-AI מתחיל לעבוד מיד.",
                icon: LayoutGrid,
              },
              {
                step: "03",
                title: "הורד ופרסם",
                desc: "התוכן מוכן תוך שניות עד דקות. הורד ישירות והעלה לאינסטגרם, פייסבוק, טיקטוק או כל פלטפורמה.",
                icon: Play,
              },
            ].map((item) => (
              <div
                key={item.step}
                className="relative text-center p-6 sm:p-8 rounded-2xl bg-white/[0.03] border border-white/5"
              >
                <div className="text-5xl sm:text-6xl font-black text-white/[0.04] absolute top-4 left-4">
                  {item.step}
                </div>
                <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-5">
                  <item.icon className="h-6 w-6 text-indigo-400" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-2">
                  {item.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── GALLERY ─── */}
      <section id="gallery" className="py-16 sm:py-24 relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 sm:mb-16">
            <Badge
              variant="outline"
              className="mb-4 border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs sm:text-sm px-4 py-1 backdrop-blur-md"
            >
              <Wand2 className="h-3.5 w-3.5 ml-1.5 inline" />
              נוצר ב-kossem AI
            </Badge>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-4">
              ראה מה אפשר ליצור
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-lg">
              הכל נוצר מפרומפטים בעברית בלבד. המערכת מסוגלת ליצור כל מה
              שתדמיינו.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Carousel preview */}
            <div className="col-span-2 row-span-2 relative rounded-2xl overflow-hidden border border-emerald-500/30 bg-slate-900/60 p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-7 w-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Images className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-bold">קרוסלה</p>
                  <p className="text-[10px] text-slate-500">5 שקופיות</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="relative aspect-[4/5] rounded-lg overflow-hidden border border-white/10"
                  >
                    <Image
                      src={`/examples/carousels/legal-${i}.png`}
                      alt={`שקופית ${i}`}
                      fill
                      className="object-cover"
                      sizes="25vw"
                    />
                    <div className="absolute top-1.5 left-1.5 h-5 w-5 rounded-full bg-slate-950/80 backdrop-blur flex items-center justify-center border border-emerald-500/50">
                      <span className="text-[9px] font-bold text-emerald-300">
                        {i}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-sm font-bold bg-gradient-to-r from-emerald-400 to-emerald-300 bg-clip-text text-transparent">
                ליווי משפטי ברכישת נכס נדל&quot;ן
              </p>
            </div>

            {/* Video */}
            <div className="relative rounded-2xl overflow-hidden border border-amber-500/30">
              <div className="aspect-[9/16]">
                <video
                  src="/examples/video.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
              <div className="absolute bottom-3 right-3">
                <Badge className="bg-amber-500/80 text-white border-0 text-[10px]">
                  <Video className="h-3 w-3 ml-1" />
                  וידאו
                </Badge>
              </div>
            </div>

            {/* Caricature */}
            <div className="relative rounded-2xl overflow-hidden border border-pink-500/30">
              <div className="aspect-[9/16] relative">
                <Image
                  src="/examples/caricature.png"
                  alt="קריקטורה"
                  fill
                  className="object-cover"
                  sizes="25vw"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
              <div className="absolute bottom-3 right-3">
                <Badge className="bg-pink-500/80 text-white border-0 text-[10px]">
                  קריקטורה
                </Badge>
              </div>
            </div>

            {/* Character AI */}
            <div className="relative rounded-2xl overflow-hidden border border-cyan-500/30">
              <div className="aspect-square relative">
                <Image
                  src="/examples/character-ai.png"
                  alt="אימון דמות"
                  fill
                  className="object-cover"
                  sizes="25vw"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
              <div className="absolute bottom-3 right-3">
                <Badge className="bg-cyan-500/80 text-white border-0 text-[10px]">
                  <User className="h-3 w-3 ml-1" />
                  אווטאר AI
                </Badge>
              </div>
            </div>

            {/* Image edit */}
            <div className="relative rounded-2xl overflow-hidden border border-purple-500/30">
              <div className="aspect-square relative">
                <Image
                  src="/examples/image-edit-2.png"
                  alt="עריכה"
                  fill
                  className="object-cover"
                  sizes="25vw"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
              <div className="absolute bottom-3 right-3">
                <Badge className="bg-purple-500/80 text-white border-0 text-[10px]">
                  <PenLine className="h-3 w-3 ml-1" />
                  עריכה
                </Badge>
              </div>
            </div>

            {/* South America carousel */}
            <div className="col-span-2 relative rounded-2xl overflow-hidden border border-emerald-500/30 bg-slate-900/60 p-4">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="relative w-28 sm:w-36 aspect-[4/5] rounded-lg overflow-hidden border border-white/10 flex-shrink-0"
                  >
                    <Image
                      src={`/examples/carousels/south-america-${i}.png`}
                      alt={`טיול ${i}`}
                      fill
                      className="object-cover"
                      sizes="144px"
                    />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-sm font-bold bg-gradient-to-r from-emerald-400 to-emerald-300 bg-clip-text text-transparent">
                החופשה שלי בדרום אמריקה
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── WHO IS IT FOR ─── */}
      <section className="py-16 sm:py-24 bg-slate-900/40 border-y border-white/5">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-4">
              למי זה מתאים?
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: ShoppingBag,
                title: "מותגים ועסקים",
                desc: "תוכן פרסומי מושך בלי סוכנות יקרה",
              },
              {
                icon: Megaphone,
                title: "משפיענים ויוצרים",
                desc: "רילז, סטוריז ופוסטים ייחודיים כל יום",
              },
              {
                icon: Camera,
                title: "מנהלי סושיאל",
                desc: "10 פוסטים ביום במקום 2 - בלי שחיקה",
              },
              {
                icon: Scissors,
                title: "סוכנויות דיגיטל",
                desc: "תוכן מותאם ללקוחות בקנה מידה גדול",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="text-center p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/15 transition-all duration-300"
              >
                <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
                  <item.icon className="h-6 w-6 text-purple-400" />
                </div>
                <h3 className="font-bold text-lg mb-1">{item.title}</h3>
                <p className="text-slate-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section className="py-16 sm:py-24 relative overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 sm:mb-16">
            <div className="flex justify-center gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className="h-6 w-6 sm:h-8 sm:w-8 fill-amber-400 text-amber-400"
                />
              ))}
            </div>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-4">
              מה אומרים המשתמשים
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              {
                name: "מלווה משקיעים NYG",
                src: "/examples/nirel.png",
                quote:
                  "הקרוסלות שנוצרות פה הן ברמה של סוכנות. חסכתי אלפי שקלים בחודש.",
              },
              {
                name: 'רויאל ז\'אווי - מנכ"לית Mocart',
                src: "/examples/royal.png",
                quote:
                  "מרגע שהתחלתי להשתמש ב-kossem, ה-engagement בעמוד קפץ ב-300%. תמונות שעוצרות את הגלילה.",
              },
              {
                name: "עו\"ד גניר שמעון",
                src: "/examples/image-edit-3.png",
                quote:
                  "בתור עורך דין, אני צריך תוכן מקצועי ומהיר. kossem מייצר לי קרוסלות מידע ברמה הכי גבוהה.",
              },
              {
                name: "שחף לוונבראון - יוצרת תוכן",
                src: "/examples/shahaf.png",
                quote:
                  "הוידאו AI פשוט מטורף. אני יוצרת רילז בלי לצאת מהבית ובלי ציוד צילום.",
              },
            ].map((t) => (
              <div
                key={t.name}
                className="p-5 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/15 transition-all duration-300"
              >
                <Quote className="h-6 w-6 text-indigo-500/40 mb-3" />
                <p className="text-slate-300 text-sm leading-relaxed mb-5">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className="relative w-10 h-10 rounded-full overflow-hidden border border-white/20 ring-2 ring-indigo-500/20 flex-shrink-0">
                    <Image
                      src={t.src}
                      alt={t.name}
                      fill
                      className="object-cover"
                      sizes="40px"
                    />
                  </div>
                  <p className="text-xs text-slate-400 leading-tight">
                    {t.name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section
        id="pricing"
        className="py-16 sm:py-24 bg-slate-900/40 border-y border-white/5"
      >
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-4">
              תמחור שמתאים לך
            </h2>
            <p className="text-slate-400 text-sm sm:text-lg">
              שלם רק על מה שאתה צריך. ביטול בלחיצה אחת.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
            {/* Free */}
            <Card className="bg-white/[0.03] border-white/10 text-slate-100 hover:border-white/20 transition-colors">
              <CardContent className="p-6 sm:p-8">
                <h3 className="text-lg font-bold mb-1">מתחילים</h3>
                <p className="text-xs text-slate-500 mb-4">
                  להתנסות ולהתרשם
                </p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold">&#8362;0</span>
                  <span className="text-slate-500 text-sm">/ חודש</span>
                </div>
                <ul className="space-y-3 mb-8 text-sm text-slate-300">
                  <li className="flex gap-3">
                    <Check className="h-5 w-5 text-emerald-500 flex-shrink-0" />{" "}
                    10 תמונות חינם
                  </li>
                  <li className="flex gap-3">
                    <Check className="h-5 w-5 text-emerald-500 flex-shrink-0" />{" "}
                    2 סרטוני וידאו
                  </li>
                  <li className="flex gap-3">
                    <Check className="h-5 w-5 text-emerald-500 flex-shrink-0" />{" "}
                    גישה לכל הכלים
                  </li>
                </ul>
                <Button className="w-full bg-slate-800 hover:bg-slate-700" asChild>
                  <Link href="/signup">התחל חינם</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Pro */}
            <Card className="bg-indigo-600/10 border-indigo-500/50 text-slate-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
              <CardContent className="p-6 sm:p-8">
                <div className="absolute top-3 left-3 bg-indigo-500 text-white text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                  הכי פופולרי
                </div>
                <h3 className="text-lg font-bold mb-1 text-indigo-300">
                  יוצר תוכן
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  לבעלי מותג ומשפיענים
                </p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold">&#8362;139</span>
                  <span className="text-slate-500 text-sm">/ חודש</span>
                </div>
                <ul className="space-y-3 mb-8 text-sm text-slate-300">
                  <li className="flex gap-3">
                    <Check className="h-5 w-5 text-indigo-400 flex-shrink-0" />{" "}
                    150 תמונות בחודש
                  </li>
                  <li className="flex gap-3">
                    <Check className="h-5 w-5 text-indigo-400 flex-shrink-0" />{" "}
                    20 קרוסלות מותאמות
                  </li>
                  <li className="flex gap-3">
                    <Check className="h-5 w-5 text-indigo-400 flex-shrink-0" />{" "}
                    סוכן קופירייטר אישי
                  </li>
                  <li className="flex gap-3">
                    <Check className="h-5 w-5 text-indigo-400 flex-shrink-0" />{" "}
                    אימון דמות חינם
                  </li>
                </ul>
                <Button
                  className="w-full bg-indigo-600 hover:bg-indigo-500 font-bold"
                  asChild
                >
                  <Link href="/signup?plan=starter">שדרג עכשיו</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Agency */}
            <Card className="bg-white/[0.03] border-white/10 text-slate-100 hover:border-white/20 transition-colors">
              <CardContent className="p-6 sm:p-8">
                <h3 className="text-lg font-bold mb-1">מקצוען</h3>
                <p className="text-xs text-slate-500 mb-4">
                  לסוכנויות וצוותים
                </p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold">&#8362;229</span>
                  <span className="text-slate-500 text-sm">/ חודש</span>
                </div>
                <ul className="space-y-3 mb-8 text-sm text-slate-300">
                  <li className="flex gap-3">
                    <Check className="h-5 w-5 text-emerald-500 flex-shrink-0" />{" "}
                    300 תמונות בחודש
                  </li>
                  <li className="flex gap-3">
                    <Check className="h-5 w-5 text-emerald-500 flex-shrink-0" />{" "}
                    50 קרוסלות
                  </li>
                  <li className="flex gap-3">
                    <Check className="h-5 w-5 text-emerald-500 flex-shrink-0" />{" "}
                    יצירת סרטוני וידאו
                  </li>
                  <li className="flex gap-3">
                    <Check className="h-5 w-5 text-emerald-500 flex-shrink-0" />{" "}
                    2 דמויות אישיות
                  </li>
                </ul>
                <Button className="w-full bg-slate-800 hover:bg-slate-700" asChild>
                  <Link href="/signup?plan=pro">בחר תוכנית</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-4">
              שאלות נפוצות
            </h2>
          </div>

          <div className="space-y-4">
            {[
              {
                q: "האם באמת חינם להתחיל?",
                a: "כן. תקבלו 10 תמונות מתנה ללא כרטיס אשראי. אתם יכולים ליצור תמונות, לבדוק את האיכות ולהחליט אם להמשיך.",
              },
              {
                q: "כמה זמן לוקח ליצור תמונה?",
                a: "תמונה נוצרת תוך 5-15 שניות. וידאו לוקח 1-3 דקות. קרוסלה עם 5 שקופיות - כ-30 שניות.",
              },
              {
                q: "האם התוכן שנוצר שייך לי?",
                a: "כן. כל תוכן שנוצר שייך לך לחלוטין. אתה יכול להשתמש בו לכל מטרה מסחרית - פרסום, מכירות, רשתות חברתיות.",
              },
              {
                q: "האם זה באמת עובד בעברית?",
                a: "לגמרי. המנועים שלנו מותאמים לעברית - גם הממשק וגם ההנחיות. אתה כותב בעברית ומקבל תוצאות מדהימות.",
              },
              {
                q: "מה ההבדל בינכם לבין Canva או מעצב?",
                a: "Canva דורש עיצוב ידני. מעצב עולה אלפי שקלים בחודש. kossem יוצר תוכן מקצועי מתיאור טקסט - תוך שניות ובחלק קטן מהעלות.",
              },
              {
                q: "האם אפשר לבטל בכל עת?",
                a: "כמובן. ביטול בלחיצה אחת מתוך ההגדרות, ללא שאלות וללא התחייבות.",
              },
            ].map((item) => (
              <details
                key={item.q}
                className="group p-5 sm:p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all cursor-pointer"
              >
                <summary className="flex items-center justify-between font-bold text-sm sm:text-base list-none">
                  {item.q}
                  <ChevronDown className="h-5 w-5 text-slate-500 group-open:rotate-180 transition-transform duration-200 flex-shrink-0 mr-3" />
                </summary>
                <p className="mt-3 text-slate-400 text-sm leading-relaxed">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="py-16 sm:py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-600/10 via-purple-600/10 to-transparent pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10 text-center">
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-4">
            מוכן ליצור תוכן
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
              שמוכר?
            </span>
          </h2>
          <p className="text-slate-400 max-w-lg mx-auto mb-8 text-sm sm:text-lg">
            הצטרף לאלפי בעלי מותג שכבר יוצרים תוכן מנצח עם kossem AI.
          </p>
          <Button
            size="lg"
            className="h-14 px-10 text-lg bg-white text-slate-900 hover:bg-slate-200 border-0 shadow-xl shadow-white/10 font-bold"
            asChild
          >
            <Link href={ctaHref}>
              <Zap className="ml-2 h-5 w-5" />
              {user ? "המשך ליצור" : "התחל בחינם - 10 תמונות מתנה"}
            </Link>
          </Button>
          <p className="text-slate-600 text-xs mt-4">
            ללא כרטיס אשראי. ביטול בכל עת.
          </p>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/10 py-10 sm:py-14 bg-slate-950">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4 opacity-60">
            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="h-3 w-3 text-white" />
            </div>
            <span className="font-bold">kossem AI</span>
          </div>
          <div className="flex justify-center gap-8 text-sm text-slate-500 mb-8">
            <Link
              href="/terms"
              className="hover:text-white transition-colors"
            >
              תנאי שימוש
            </Link>
            <Link
              href="/privacy"
              className="hover:text-white transition-colors"
            >
              מדיניות פרטיות
            </Link>
            <Link
              href="/contact"
              className="hover:text-white transition-colors"
            >
              צור קשר
            </Link>
          </div>
          <p className="text-slate-600 text-xs">
            &copy; {new Date().getFullYear()} kossem AI. כל הזכויות שמורות.
          </p>
        </div>
      </footer>
    </div>
  );
}
