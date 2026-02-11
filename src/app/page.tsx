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
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const galleryImages = [
  {
    src: "/examples/astronaut.png",
    label: "תמונה מפרומפט",
    prompt: "אסטרונאוט צועד על מאדים בשקיעה כתומה, סגנון קולנועי",
    color: "indigo" as const,
  },
  {
    src: "/examples/caricature-example.png",
    label: "קריקטורה / דמות",
    prompt: "קריקטורה מעוצבת בסגנון קומיקס מתמונת פנים אמיתית",
    color: "pink" as const,
  },
];

const carouselSlides = [
  "/examples/carousel/1.png",
  "/examples/carousel/2.png",
  "/examples/carousel/3.png",
  "/examples/carousel/4.png",
  "/examples/carousel/5.png",
  "/examples/carousel/6.png",
];

const colorMap: Record<string, { badge: string; border: string }> = {
  indigo: {
    badge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
    border: "group-hover:border-indigo-500/50",
  },
  pink: {
    badge: "bg-pink-500/10 text-pink-400 border-pink-500/30",
    border: "group-hover:border-pink-500/50",
  },
};

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 selection:bg-indigo-500/30" dir="rtl">
      {/* Background Effects */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[100px] animate-pulse delay-1000" />
        <div className="absolute top-[40%] left-[50%] translate-x-[-50%] w-[800px] h-[800px] bg-slate-900/50 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      </div>

      {/* Header */}
      <header className="fixed top-0 w-full z-50 border-b border-white/5 bg-slate-950/60 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
              🧙
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              קוסם AI
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
            <Link href="#features" className="hover:text-white transition-colors">יכולות</Link>
            <Link href="#pricing" className="hover:text-white transition-colors">מחירים</Link>
            <Link href="#gallery" className="hover:text-white transition-colors">דוגמאות</Link>
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <Button asChild variant="outline" className="border-indigo-500/30 hover:bg-indigo-500/10 hover:text-indigo-300">
                <Link href="/dashboard">
                  הכנס למערכת
                  <ArrowLeft className="mr-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Link href="/login" className="text-sm font-medium text-slate-400 hover:text-white hidden sm:block">
                  התחברות
                </Link>
                <Button asChild className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 border-0 shadow-lg shadow-indigo-500/20">
                  <Link href="/signup">
                    התחל בחינם
                    <Sparkles className="mr-2 h-4 w-4 fill-white/20" />
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        <div className="container mx-auto px-4 relative z-10 text-center">
          <Badge variant="outline" className="mb-6 border-indigo-500/30 bg-indigo-500/10 text-indigo-300 px-4 py-1 text-sm backdrop-blur-md">
            ✨ הדור החדש של יצירת תוכן
          </Badge>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8">
            הפוך רעיונות למציאות
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-l from-indigo-400 via-purple-400 to-cyan-400 animate-gradient-x">
              עם כוח הבינה המלאכותית
            </span>
          </h1>

          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            צור תמונות מרהיבות, סרטונים ויראליים, וקרוסלות מקצועיות לאינסטגרם תוך שניות.
            <br className="hidden md:block" />
            הכל בעברית, הכל במקום אחד.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="h-14 px-8 text-lg bg-white text-slate-900 hover:bg-slate-200 border-0 shadow-xl shadow-white/10" asChild>
              <Link href="/signup">
                <Zap className="ml-2 h-5 w-5" />
                נסה בחינם עכשיו
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-14 px-8 text-lg border-white/10 hover:bg-white/5 hover:text-white backdrop-blur-sm" asChild>
              <Link href="#gallery">
                <Play className="ml-2 h-5 w-5" />
                ראה דוגמאות
              </Link>
            </Button>
          </div>

          {/* Stats / Social Proof */}
          <div className="mt-16 pt-8 border-t border-white/5 flex flex-wrap justify-center gap-8 md:gap-16 text-slate-400">
            <div className="flex items-center gap-2">
              <Check className="text-emerald-500 h-5 w-5" />
              <span>ללא כרטיס אשראי</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="text-emerald-500 h-5 w-5" />
              <span>10 תמונות מתנה</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="text-emerald-500 h-5 w-5" />
              <span>תמיכה מלאה בעברית</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid (Bento Box Style) */}
      <section id="features" className="py-20 bg-slate-950/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">ארגז הכלים שלך</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              כל מה שיוצר תוכן צריך, בממשק אחד פשוט וחכם.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[300px]">
            {/* Large Card: Text to Image */}
            <div className="md:col-span-2 row-span-1 md:row-span-2 group relative overflow-hidden rounded-3xl bg-slate-900/50 border border-white/10 hover:border-indigo-500/50 transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-950/90 z-10" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-900/40 via-slate-950 to-slate-950 opacity-100 group-hover:scale-105 transition-transform duration-700" />

              <div className="relative z-20 p-8 h-full flex flex-col justify-end">
                <div className="h-12 w-12 rounded-xl bg-indigo-500/20 flex items-center justify-center mb-4 backdrop-blur-md">
                  <Sparkles className="h-6 w-6 text-indigo-400" />
                </div>
                <h3 className="text-2xl font-bold mb-2">מחולל תמונות מתקדם</h3>
                <p className="text-slate-400 mb-6 max-w-lg">
                  כתוב מה אתה מדמיין – וקבל תמונה פוטוריאליסטית תוך שניות.
                  המנוע שלנו מבין ניואנסים בעברית ויודע ליצור הכל: מתמונות מוצר ועד אומנות פנטזיה.
                </p>
                <Button variant="secondary" className="w-fit" asChild>
                  <Link href="/generate/image">נסה עכשיו</Link>
                </Button>
              </div>
            </div>

            {/* Card: Reel Converter */}
            <div className="group relative overflow-hidden rounded-3xl bg-slate-900/50 border border-white/10 hover:border-pink-500/50 transition-all duration-300">
              <div className="absolute top-0 right-0 p-8">
                <div className="h-12 w-12 rounded-xl bg-pink-500/20 flex items-center justify-center backdrop-blur-md">
                  <Film className="h-6 w-6 text-pink-400" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-slate-950 to-transparent">
                <h3 className="text-xl font-bold mb-2">רילז לקרוסלה</h3>
                <p className="text-slate-400 text-sm">
                  הדבק קישור לרילז, קבל אוטומטית 10 פריימים מנצחים לקרוסלה.
                </p>
              </div>
            </div>

            {/* Card: Character Training */}
            <div className="group relative overflow-hidden rounded-3xl bg-slate-900/50 border border-white/10 hover:border-cyan-500/50 transition-all duration-300">
              <div className="absolute top-0 right-0 p-8">
                <div className="h-12 w-12 rounded-xl bg-cyan-500/20 flex items-center justify-center backdrop-blur-md">
                  <User className="h-6 w-6 text-cyan-400" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-slate-950 to-transparent">
                <h3 className="text-xl font-bold mb-2">אימון דמות (LoRA)</h3>
                <p className="text-slate-400 text-sm">
                  אמן את ה-AI להכיר את הפנים שלך. צור תוכן בכיכובך בכל סגנון.
                </p>
              </div>
            </div>

            {/* Card: Video Generation */}
            <div className="md:col-span-1 group relative overflow-hidden rounded-3xl bg-slate-900/50 border border-white/10 hover:border-amber-500/50 transition-all duration-300">
              <div className="absolute top-0 right-0 p-8">
                <div className="h-12 w-12 rounded-xl bg-amber-500/20 flex items-center justify-center backdrop-blur-md">
                  <Video className="h-6 w-6 text-amber-400" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-slate-950 to-transparent">
                <h3 className="text-xl font-bold mb-2">טקסט לוידאו</h3>
                <p className="text-slate-400 text-sm">
                  הנפש תמונות או צור סרטונים מאפס. הקסם קורה בתנועה.
                </p>
              </div>
            </div>

            {/* Card: Carousels */}
            <div className="md:col-span-2 group relative overflow-hidden rounded-3xl bg-slate-900/50 border border-white/10 hover:border-emerald-500/50 transition-all duration-300 flex items-center justify-between p-8">
              <div className="max-w-xs">
                <div className="h-12 w-12 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-4 backdrop-blur-md">
                  <Images className="h-6 w-6 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold mb-2">קרוסלות ממותגות</h3>
                <p className="text-slate-400 text-sm">
                  יצירת קרוסלות מידע (Educational) או סיפוריות, כולל המיתוג והלוגו שלך באופן אוטומטי.
                </p>
              </div>
              <div className="hidden sm:block h-32 w-48 bg-emerald-500/10 rounded-lg border border-emerald-500/20 rotate-[-5deg] transform group-hover:rotate-0 transition-all" />
            </div>
          </div>
        </div>
      </section>

      {/* Gallery / Examples Section */}
      <section id="gallery" className="py-20 relative overflow-hidden">
        {/* Section Background Glow */}
        <div className="absolute top-0 left-[50%] translate-x-[-50%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 border-purple-500/30 bg-purple-500/10 text-purple-300 px-4 py-1 text-sm backdrop-blur-md">
              <Wand2 className="h-3.5 w-3.5 ml-1.5 inline" />
              נוצר ב-קוסם AI
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">ראה מה אפשר ליצור</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              כל התוכן נוצר עם המערכת שלנו, מפרומפטים בעברית בלבד. בדיוק מה שתקבלו גם אתם.
            </p>
          </div>

          {/* Row 1: Image Generation Examples */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
            {galleryImages.map((item, index) => {
              const colors = colorMap[item.color];
              return (
                <div
                  key={index}
                  className={`group relative rounded-2xl overflow-hidden border border-white/10 ${colors.border} bg-slate-900/50 transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/5`}
                >
                  <div className="relative aspect-square bg-slate-800/50 overflow-hidden">
                    <Image
                      src={item.src}
                      alt={item.prompt}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, 50vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500" />

                    {/* Category Badge */}
                    <div className="absolute top-4 right-4 z-10">
                      <span className={`text-xs font-medium px-3 py-1 rounded-full border backdrop-blur-md ${colors.badge}`}>
                        {item.label}
                      </span>
                    </div>

                    {/* Prompt on hover */}
                    <div className="absolute bottom-0 left-0 right-0 p-5 z-10 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                      <div className="flex items-start gap-2">
                        <Sparkles className="h-4 w-4 text-indigo-400 mt-0.5 shrink-0" />
                        <p className="text-sm text-slate-200 leading-relaxed">
                          &quot;{item.prompt}&quot;
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Row 2: Video Example */}
          <div className="mb-5">
            <div className="group relative rounded-2xl overflow-hidden border border-white/10 hover:border-amber-500/50 bg-slate-900/50 transition-all duration-500 hover:shadow-2xl hover:shadow-amber-500/5">
              <div className="relative aspect-video bg-slate-800/50 overflow-hidden">
                <video
                  src="/examples/astronaut-video.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />

                {/* Badge */}
                <div className="absolute top-4 right-4 z-10">
                  <span className="text-xs font-medium px-3 py-1 rounded-full border backdrop-blur-md bg-amber-500/10 text-amber-400 border-amber-500/30">
                    <Video className="h-3 w-3 inline ml-1" />
                    טקסט לוידאו
                  </span>
                </div>

                {/* Caption */}
                <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
                  <div className="flex items-start gap-2">
                    <Sparkles className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-slate-200 leading-relaxed">
                      &quot;אסטרונאוט צועד על פני מאדים, צילום קולנועי, תנועה איטית&quot;
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Carousel Example */}
          <div className="group relative rounded-2xl overflow-hidden border border-white/10 hover:border-emerald-500/50 bg-slate-900/50 transition-all duration-500 hover:shadow-2xl hover:shadow-emerald-500/5 p-6 md:p-8">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center backdrop-blur-md">
                <Images className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold">קרוסלה לאינסטגרם</h3>
                <p className="text-xs text-slate-500">6 שקופיות • נוצרו אוטומטית מפרומפט אחד</p>
              </div>
              <span className="mr-auto text-xs font-medium px-3 py-1 rounded-full border backdrop-blur-md bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                קרוסלה
              </span>
            </div>

            {/* Carousel Horizontal Scroll */}
            <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent snap-x snap-mandatory">
              {carouselSlides.map((slide, index) => (
                <div
                  key={index}
                  className="relative shrink-0 w-48 md:w-56 aspect-[4/5] rounded-xl overflow-hidden border border-white/10 hover:border-emerald-500/30 transition-all snap-center"
                >
                  <Image
                    src={slide}
                    alt={`שקופית ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="224px"
                  />
                  {/* Slide Number */}
                  <div className="absolute top-2 left-2 h-6 w-6 rounded-full bg-slate-950/70 backdrop-blur-md flex items-center justify-center">
                    <span className="text-[10px] font-bold text-slate-300">{index + 1}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA under gallery */}
          <div className="text-center mt-14">
            <p className="text-slate-500 mb-6 text-sm">
              זו רק ההתחלה. המערכת מסוגלת ליצור כל מה שתדמיינו.
            </p>
            <Button size="lg" className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 border-0 shadow-lg shadow-indigo-500/20 h-12 px-8" asChild>
              <Link href="/signup">
                <Sparkles className="ml-2 h-4 w-4 fill-white/20" />
                צור את התמונה הראשונה שלך
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 relative">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">תמחור גמיש</h2>
            <p className="text-slate-400">שלם רק על מה שאתה צריך, או בחר מנוי משתלם.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Free Plan */}
            <Card className="bg-white/5 border-white/10 text-slate-100 backdrop-blur-sm hover:bg-white/10 transition-colors">
              <CardContent className="p-8">
                <h3 className="text-xl font-bold mb-2">מתחילים</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold">₪0</span>
                  <span className="text-slate-400">/ חודש</span>
                </div>
                <ul className="space-y-4 mb-8 text-sm text-slate-300">
                  <li className="flex gap-3"><Check className="h-5 w-5 text-emerald-500" /> 10 תמונות חינם</li>
                  <li className="flex gap-3"><Check className="h-5 w-5 text-emerald-500" /> 2 המרות רילז</li>
                  <li className="flex gap-3"><Check className="h-5 w-5 text-emerald-500" /> גישה לכל הכלים</li>
                </ul>
                <Button className="w-full bg-slate-800 hover:bg-slate-700" asChild>
                  <Link href="/signup">התחל חינם</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Pro Plan */}
            <Card className="bg-indigo-600/10 border-indigo-500/50 text-slate-100 relative overflow-hidden backdrop-blur-sm">
              <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
              <div className="absolute -right-12 -top-12 w-24 h-24 bg-indigo-500/30 blur-2xl rounded-full" />

              <CardContent className="p-8">
                <div className="absolute top-4 left-4 bg-indigo-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                  פופולרי
                </div>
                <h3 className="text-xl font-bold mb-2 text-indigo-300">יוצר תוכן</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold">₪139</span>
                  <span className="text-slate-400">/ חודש</span>
                </div>
                <ul className="space-y-4 mb-8 text-sm text-slate-300">
                  <li className="flex gap-3"><Check className="h-5 w-5 text-indigo-400" /> 250 תמונות בחודש</li>
                  <li className="flex gap-3"><Check className="h-5 w-5 text-indigo-400" /> 20 קרוסלות מותאמות</li>
                  <li className="flex gap-3"><Check className="h-5 w-5 text-indigo-400" /> סוכן קופירייטר אישי</li>
                  <li className="flex gap-3"><Check className="h-5 w-5 text-indigo-400" /> אימון דמות אישית חינם</li>
                </ul>
                <Button className="w-full bg-indigo-600 hover:bg-indigo-500" asChild>
                  <Link href="/signup?plan=starter">שדרג עכשיו</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Agency Plan */}
            <Card className="bg-white/5 border-white/10 text-slate-100 backdrop-blur-sm hover:bg-white/10 transition-colors">
              <CardContent className="p-8">
                <h3 className="text-xl font-bold mb-2">מקצוען</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold">₪229</span>
                  <span className="text-slate-400">/ חודש</span>
                </div>
                <ul className="space-y-4 mb-8 text-sm text-slate-300">
                  <li className="flex gap-3"><Check className="h-5 w-5 text-emerald-500" /> 500 תמונות בחודש</li>
                  <li className="flex gap-3"><Check className="h-5 w-5 text-emerald-500" /> 50 קרוסלות</li>
                  <li className="flex gap-3"><Check className="h-5 w-5 text-emerald-500" /> יצירת סרטוני וידאו</li>
                  <li className="flex gap-3"><Check className="h-5 w-5 text-emerald-500" /> 2 דמויות אישיות</li>
                </ul>
                <Button className="w-full bg-slate-800 hover:bg-slate-700" asChild>
                  <Link href="/signup?plan=pro">צור קשר</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 bg-slate-950">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4 opacity-50">
            <span className="text-2xl">🧙</span>
            <span className="font-bold">קוסם AI</span>
          </div>
          <div className="flex justify-center gap-8 text-sm text-slate-500 mb-8">
            <Link href="/terms" className="hover:text-white transition-colors">תנאי שימוש</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">מדיניות פרטיות</Link>
            <Link href="/contact" className="hover:text-white transition-colors">צור קשר</Link>
          </div>
          <p className="text-slate-600 text-xs">
            © {new Date().getFullYear()} קוסם AI. כל הזכויות שמורות.
          </p>
        </div>
      </footer>
    </div>
  );
}