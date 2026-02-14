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
          <h1 className="text-4xl font-bold mb-4">תנאי שימוש</h1>
          <p className="text-gray-500 mb-2">עודכן לאחרונה: יוני 2025</p>
          <p className="text-sm text-gray-400 mb-12">גרסה 2.0</p>

          <div className="prose prose-lg max-w-none space-y-10 text-gray-700">
            {/* 1. Introduction */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">1. הקדמה והגדרות</h2>
              <p>
                ברוכים הבאים ל&quot;קוסם&quot; (להלן: &quot;השירות&quot;, &quot;הפלטפורמה&quot;, &quot;אנחנו&quot;) – פלטפורמה אינטרנטית מבוססת בינה מלאכותית (AI) ליצירת תוכן ויזואלי. שימוש בשירות מהווה הסכמה מלאה ובלתי מותנית לתנאים אלה. אם אינך מסכים לתנאים – אל תשתמש בשירות.
              </p>
              <p className="mt-3">בתנאים אלה:</p>
              <ul className="list-disc pr-6 space-y-2 mt-2">
                <li><strong>&quot;משתמש&quot;</strong> – כל אדם או ישות המשתמשים בפלטפורמה, בין אם בתשלום ובין אם בחינם.</li>
                <li><strong>&quot;תוכן&quot;</strong> – כל תמונה, סרטון, קרוסלה, טקסט או חומר ויזואלי אחר שנוצר באמצעות הפלטפורמה.</li>
                <li><strong>&quot;קרדיטים&quot;</strong> – יחידות דיגיטליות המשמשות לתשלום עבור פעולות יצירה בפלטפורמה.</li>
                <li><strong>&quot;דמות&quot;</strong> – מודל AI מותאם אישית שנוצר מתמונות שהמשתמש מעלה.</li>
                <li><strong>&quot;חשבון&quot;</strong> – חשבון המשתמש הרשום בפלטפורמה.</li>
              </ul>
            </section>

            {/* 2. Description */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">2. תיאור השירות</h2>
              <p>קוסם מספקת כלי AI ליצירת תוכן ויזואלי, לרבות:</p>
              <ul className="list-disc pr-6 space-y-2 mt-3">
                <li>יצירת תמונות מטקסט (Text-to-Image)</li>
                <li>יצירת סרטוני וידאו מטקסט או מתמונה</li>
                <li>יצירת קרוסלות לרשתות חברתיות</li>
                <li>המרת סרטונים לרילז ותוכן קצר</li>
                <li>חיתוך וידאו אוטומטי</li>
                <li>יצירת קריקטורה וסגנונות אמנותיים</li>
                <li>אימון דמויות מותאמות אישית (LoRA)</li>
                <li>יצירת תוכן עם דמויות מאומנות</li>
              </ul>
              <p className="mt-3">
                השירות פועל באמצעות מודלי בינה מלאכותית של צדדים שלישיים ואינו מבטיח תוצאות ספציפיות. תוצאות עשויות להשתנות בהתאם לפרמטרים שהוזנו.
              </p>
            </section>

            {/* 3. Registration */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">3. הרשמה וחשבון משתמש</h2>
              <ul className="list-disc pr-6 space-y-2">
                <li>השימוש בשירות מחייב הרשמה וזיהוי באמצעות כתובת אימייל או חשבון Google.</li>
                <li>עליך לספק מידע מדויק ועדכני בעת ההרשמה.</li>
                <li>אתה אחראי לשמירה על סודיות פרטי ההתחברות שלך.</li>
                <li>אין להעביר, לשתף או למכור את חשבונך לאחר.</li>
                <li>יש להודיע לנו מיידית על כל שימוש לא מורשה בחשבונך.</li>
                <li>השימוש בשירות מותר לגילאי 18 ומעלה בלבד. שימוש על ידי קטינים הוא באחריות ההורים או האפוטרופוס.</li>
              </ul>
            </section>

            {/* 4. Allowed Use */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">4. שימוש מותר</h2>
              <ul className="list-disc pr-6 space-y-2">
                <li>יצירת תוכן מקורי לחשבונות האישיים או העסקיים שלך</li>
                <li>שימוש בתוכן שנוצר לשיווק, פרסום, מיתוג ופרסום ברשתות חברתיות</li>
                <li>יצירת תוכן לצורכי למידה, מחקר והדגמה</li>
                <li>שימוש בתמונות וסרטונים שנוצרו במסגרת פרויקטים עסקיים</li>
                <li>יצירת דמויות מותאמות מתמונות שלך או שקיבלת הרשאה מפורשת לשימוש בהן</li>
              </ul>
            </section>

            {/* 5. Prohibited Use */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">5. שימוש אסור</h2>
              <p className="mb-3">חל איסור מוחלט על:</p>
              <ul className="list-disc pr-6 space-y-2">
                <li>יצירת תוכן פורנוגרפי, מיני, אלים או פוגעני</li>
                <li>יצירת תוכן המכיל דברי שנאה, גזענות או הסתה</li>
                <li>זיוף דמויות (Deepfake) של אנשים אמיתיים ללא הסכמתם המפורשת בכתב</li>
                <li>התחזות לאדם אחר או גניבת זהות</li>
                <li>הפצת דיסאינפורמציה, חדשות מזויפות או תוכן מטעה</li>
                <li>שימוש בתוכן שנוצר להונאה, תרמית או פעילות בלתי חוקית</li>
                <li>העלאת תמונות של אנשים ללא הסכמתם לצורך אימון דמויות</li>
                <li>העלאת תמונות של קטינים לצורך אימון דמויות</li>
                <li>הפרת זכויות יוצרים, סימני מסחר או קניין רוחני של צד שלישי</li>
                <li>שימוש אוטומטי (בוטים, סקריפטים) ללא אישור מפורש מאיתנו</li>
                <li>ניסיון לעקוף מגבלות השירות, מערכת הקרדיטים או אמצעי האבטחה</li>
                <li>מכירה חוזרת של השירות או הענקת גישה לצדדים שלישיים ללא אישור</li>
                <li>העמסה מכוונת על השרתים או גרימת נזק לתשתיות השירות</li>
              </ul>
              <p className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <strong>⚠️ אזהרה:</strong> הפרת תנאים אלה עלולה לגרום להשעיית או ביטול החשבון באופן מיידי, ללא החזר כספי, ולנקיטת הליכים משפטיים במקרה הצורך.
              </p>
            </section>

            {/* 6. Credits & Payments */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">6. קרדיטים, תמחור ותשלומים</h2>

              <h3 className="text-xl font-medium mt-6 mb-3">6.1 מערכת קרדיטים</h3>
              <ul className="list-disc pr-6 space-y-2">
                <li>השירות פועל על מערכת קרדיטים. כל פעולת יצירה צורכת מספר קרדיטים בהתאם לסוגה.</li>
                <li>עלות הקרדיטים לכל פעולה מוצגת בפלטפורמה ועשויה להשתנות מעת לעת.</li>
                <li>קרדיטים שנרכשו אינם פגים ואין להם תאריך תפוגה.</li>
                <li>קרדיטים אינם ניתנים להעברה בין חשבונות.</li>
                <li>קרדיטים בונוס שניתנו בחינם עשויים להיות כפופים לתנאים נוספים.</li>
              </ul>

              <h3 className="text-xl font-medium mt-6 mb-3">6.2 רכישת קרדיטים</h3>
              <ul className="list-disc pr-6 space-y-2">
                <li>ניתן לרכוש חבילות קרדיטים באמצעות כרטיס אשראי דרך מערכת התשלומים המאובטחת שלנו (Cardcom).</li>
                <li>המחירים מוצגים בשקלים חדשים (₪) וכוללים מע&quot;מ כנדרש על פי חוק.</li>
                <li>החיוב מתבצע באופן מיידי עם אישור העסקה.</li>
                <li>הקרדיטים מתווספים לחשבון באופן אוטומטי לאחר אישור התשלום.</li>
                <li>קבלה/חשבונית מס תישלח לכתובת האימייל הרשומה בחשבון.</li>
              </ul>

              <h3 className="text-xl font-medium mt-6 mb-3">6.3 מדיניות החזרים וביטולים</h3>
              <ul className="list-disc pr-6 space-y-2">
                <li>בהתאם לחוק הגנת הצרכן, ניתן לבטל עסקה תוך 14 יום מיום הרכישה, בתנאי שלא נעשה שימוש בקרדיטים שנרכשו.</li>
                <li>אם נעשה שימוש בחלק מהקרדיטים, ההחזר יהיה יחסי לקרדיטים שלא נוצלו, בניכוי דמי ביטול כקבוע בחוק.</li>
                <li>קרדיטים שנצרכו לפעולות יצירה אינם ניתנים להחזר, גם אם התוצאה לא הייתה לשביעות רצונך.</li>
                <li>במקרה של תקלה טכנית שמנעה יצירת תוכן, ניתן לפנות לתמיכה לקבלת החזר קרדיטים.</li>
                <li>בקשות ביטול וזיכוי יש להפנות לשירות הלקוחות דרך עמוד{" "}
                  <Link href="/contact" className="text-primary underline hover:no-underline">
                    יצירת קשר
                  </Link>.
                </li>
              </ul>

              <h3 className="text-xl font-medium mt-6 mb-3">6.4 שינויי מחירים</h3>
              <p>
                אנו שומרים לעצמנו את הזכות לעדכן את מחירי החבילות ואת עלות הקרדיטים לכל פעולה. שינויי מחיר לא ישפיעו על קרדיטים שכבר נרכשו.
              </p>
            </section>

            {/* 7. IP */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">7. זכויות יוצרים וקניין רוחני</h2>

              <h3 className="text-xl font-medium mt-6 mb-3">7.1 תוכן שנוצר על ידי המשתמש</h3>
              <ul className="list-disc pr-6 space-y-2">
                <li>התוכן שנוצר באמצעות הפלטפורמה שייך למשתמש שיצר אותו, בכפוף לתנאים המפורטים להלן.</li>
                <li>המשתמש רשאי להשתמש בתוכן שנוצר לכל מטרה חוקית, לרבות מטרות מסחריות.</li>
                <li>אנו שומרים לעצמנו רישיון לא בלעדי, ללא תמלוגים, להשתמש בתוכן שנוצר לצורך שיפור השירות, שיווק הפלטפורמה (באופן אנונימי) ואימון מודלים.</li>
              </ul>

              <h3 className="text-xl font-medium mt-6 mb-3">7.2 תוכן שהועלה על ידי המשתמש</h3>
              <ul className="list-disc pr-6 space-y-2">
                <li>העלאת תוכן (תמונות, סרטונים) לפלטפורמה מהווה הצהרה שיש לך את הזכויות על התוכן המועלה או שקיבלת הרשאה מפורשת מבעל הזכויות.</li>
                <li>אתה אחראי באופן בלעדי לכל תביעה הנובעת מהפרת זכויות יוצרים בתוכן שהועלה.</li>
              </ul>

              <h3 className="text-xl font-medium mt-6 mb-3">7.3 קניין רוחני של הפלטפורמה</h3>
              <p>
                כל הזכויות בפלטפורמה, לרבות עיצוב, קוד, מודלים, אלגוריתמים, סימני מסחר ותוכן שיווקי – שייכות לנו באופן בלעדי ומוגנות על ידי חוקי קניין רוחני.
              </p>
            </section>

            {/* 8. Characters */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">8. דמויות מותאמות אישית</h2>
              <ul className="list-disc pr-6 space-y-2">
                <li>שירות הדמויות המותאמות מאפשר אימון מודל AI על בסיס תמונות שהמשתמש מעלה.</li>
                <li>העלאת תמונות לאימון דמות מהווה הצהרה שיש לך הרשאה מפורשת מהאדם המצולם, או שאתה האדם המצולם.</li>
                <li><strong>חל איסור מוחלט על העלאת תמונות של קטינים</strong> לצורך אימון דמויות.</li>
                <li>חל איסור על העלאת תמונות של אנשים מפורסמים או דמויות ציבוריות ללא הסכמה.</li>
                <li>אנו שומרים לעצמנו את הזכות למחוק דמויות שנוצרו בניגוד לתנאים אלה ללא הודעה מוקדמת.</li>
                <li>התמונות שמועלות לאימון דמויות מאוחסנות באופן מאובטח ומוצפנות. ניתן למחוק את הדמות ואת כל הנתונים הקשורים בכל עת.</li>
              </ul>
            </section>

            {/* 9. Privacy & Data */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">9. פרטיות ואבטחת מידע</h2>
              <ul className="list-disc pr-6 space-y-2">
                <li>איסוף ועיבוד המידע האישי שלך נעשה בהתאם ל
                  <Link href="/privacy" className="text-primary underline hover:no-underline mx-1">
                    מדיניות הפרטיות
                  </Link>
                  שלנו, המהווה חלק בלתי נפרד מתנאי שימוש אלה.
                </li>
                <li>אנו משתמשים באמצעי אבטחה מתקדמים להגנה על המידע שלך.</li>
                <li>תשלומים מעובדים באמצעות Cardcom – מערכת תשלומים מאובטחת בתקן PCI DSS. איננו שומרים פרטי כרטיסי אשראי.</li>
                <li>המידע מאוחסן בשרתי ענן מאובטחים (Supabase/AWS).</li>
              </ul>
            </section>

            {/* 10. Storage */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">10. אחסון תוכן</h2>
              <ul className="list-disc pr-6 space-y-2">
                <li>תוכן שנוצר מאוחסן בחשבונך למשך תקופה מוגבלת בהתאם לסוג החשבון שלך.</li>
                <li>אנו ממליצים להוריד את התוכן שנוצר למחשבך בהקדם.</li>
                <li>אנו שומרים לעצמנו את הזכות למחוק תוכן ישן לאחר תקופה מוגדרת ובהתאם למדיניות האחסון.</li>
                <li>מחיקת חשבון תגרום למחיקת כל התוכן המאוחסן באופן בלתי הפיך.</li>
              </ul>
            </section>

            {/* 11. Availability */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">11. זמינות השירות</h2>
              <ul className="list-disc pr-6 space-y-2">
                <li>אנו שואפים לספק שירות רציף 24/7, אך איננו מתחייבים לזמינות מלאה ורציפה.</li>
                <li>השירות עשוי להיות מושבת זמנית לצורכי תחזוקה, עדכונים או שדרוגים.</li>
                <li>לא נישא באחריות לנזקים הנובעים מהשבתה זמנית או מתקלות טכניות.</li>
                <li>במקרה של תקלה שמנעה שימוש בקרדיטים שנרכשו, ייתכן ותינתן פיצוי בקרדיטים לפי שיקול דעתנו.</li>
              </ul>
            </section>

            {/* 12. Liability */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">12. הגבלת אחריות</h2>
              <ul className="list-disc pr-6 space-y-2">
                <li>השירות ניתן &quot;כמות שהוא&quot; (AS IS) ו-&quot;כפי שזמין&quot; (AS AVAILABLE), ללא אחריות מכל סוג.</li>
                <li>איננו אחראים לאיכות, דיוק או התאמה של התוכן שנוצר למטרות ספציפיות.</li>
                <li>איננו אחראים לנזקים ישירים, עקיפים, מקריים או תוצאתיים הנובעים משימוש או מחוסר יכולת שימוש בשירות.</li>
                <li>השימוש בתוכן שנוצר, לרבות פרסומו ברשתות חברתיות, הוא באחריות המשתמש בלבד.</li>
                <li>השימוש בתמונות וסרטונים של אנשים אמיתיים, לרבות דמויות מאומנות, הוא באחריות המשתמש בלבד.</li>
                <li>בכל מקרה, אחריותנו הכוללת לא תעלה על הסכום ששולם בפועל על ידי המשתמש ב-12 החודשים שקדמו לאירוע.</li>
              </ul>
            </section>

            {/* 13. Indemnification */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">13. שיפוי</h2>
              <p>
                המשתמש מתחייב לשפות ולפצות את קוסם, עובדיה, מנהליה ושותפיה כנגד כל תביעה, דרישה, נזק, הפסד או הוצאה (לרבות שכר טרחת עורך דין) הנובעים מ:
              </p>
              <ul className="list-disc pr-6 space-y-2 mt-3">
                <li>הפרת תנאי שימוש אלה על ידי המשתמש</li>
                <li>שימוש בלתי חוקי או בלתי מורשה בשירות</li>
                <li>תוכן שהועלה או נוצר על ידי המשתמש</li>
                <li>הפרת זכויות צד שלישי על ידי המשתמש</li>
              </ul>
            </section>

            {/* 14. Termination */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">14. השעיה וסיום</h2>
              <ul className="list-disc pr-6 space-y-2">
                <li>אנו רשאים להשעות או לבטל את חשבונך בכל עת, מכל סיבה, לרבות הפרת תנאי שימוש אלה.</li>
                <li>בהשעיה עקב הפרת תנאים – לא יינתן החזר כספי עבור קרדיטים שלא נוצלו.</li>
                <li>המשתמש רשאי למחוק את חשבונו בכל עת דרך הגדרות החשבון.</li>
                <li>לאחר מחיקת חשבון, כל הנתונים יימחקו באופן בלתי הפיך תוך 30 יום.</li>
              </ul>
            </section>

            {/* 15. Third Party */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">15. שירותי צד שלישי</h2>
              <p>הפלטפורמה משתמשת בשירותי צד שלישי, לרבות:</p>
              <ul className="list-disc pr-6 space-y-2 mt-3">
                <li><strong>מודלי AI</strong> – לצורך יצירת תוכן (Fal.ai, Google Gemini ועוד)</li>
                <li><strong>Cardcom</strong> – לעיבוד תשלומים מאובטח</li>
                <li><strong>Supabase</strong> – לאחסון נתונים ואימות משתמשים</li>
                <li><strong>Vercel</strong> – לאירוח הפלטפורמה</li>
              </ul>
              <p className="mt-3">
                שימוש בשירותים אלה כפוף גם לתנאי השימוש ומדיניות הפרטיות של ספקים אלה. איננו אחראים לפעולות או מחדלים של ספקי צד שלישי.
              </p>
            </section>

            {/* 16. Governing Law */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">16. דין חל וסמכות שיפוט</h2>
              <ul className="list-disc pr-6 space-y-2">
                <li>תנאי שימוש אלה כפופים לחוקי מדינת ישראל.</li>
                <li>כל מחלוקת תידון בבית המשפט המוסמך במחוז תל אביב בלבד.</li>
                <li>לפני פנייה לבית המשפט, הצדדים ינסו ליישב את המחלוקת בדרכי שלום תוך 30 יום.</li>
              </ul>
            </section>

            {/* 17. Changes */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">17. שינויים בתנאי השימוש</h2>
              <ul className="list-disc pr-6 space-y-2">
                <li>אנו רשאים לעדכן תנאי שימוש אלה מעת לעת.</li>
                <li>על שינויים מהותיים תישלח הודעה באימייל או באמצעות הודעה בפלטפורמה.</li>
                <li>המשך שימוש בשירות לאחר עדכון מהווה הסכמה לתנאים המעודכנים.</li>
                <li>אם אינך מסכים לתנאים המעודכנים, עליך להפסיק את השימוש בשירות.</li>
              </ul>
            </section>

            {/* 18. Miscellaneous */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">18. הוראות כלליות</h2>
              <ul className="list-disc pr-6 space-y-2">
                <li><strong>הפרדה:</strong> אם סעיף כלשהו בתנאים אלה ייקבע כבלתי תקף, שאר הסעיפים ימשיכו לעמוד בתוקפם.</li>
                <li><strong>ויתור:</strong> אי-אכיפה של סעיף כלשהו אינה מהווה ויתור על הזכות לאכוף אותו בעתיד.</li>
                <li><strong>שלמות ההסכם:</strong> תנאים אלה, יחד עם מדיניות הפרטיות, מהווים את ההסכם המלא בינך לבין קוסם.</li>
                <li><strong>העברה:</strong> איננו רשאים להעביר את זכויותינו וחובותינו על פי הסכם זה ללא הסכמתך, למעט במקרה של מיזוג, רכישה או מכירת נכסים.</li>
              </ul>
            </section>

            {/* 19. Contact */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">19. יצירת קשר</h2>
              <p>לשאלות, הבהרות או בקשות בנוגע לתנאי השימוש:</p>
              <div className="mt-4 p-6 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                <p>
                  📧 אימייל:{" "}
                  <a href="mailto:support@kossem.co.il" className="text-primary underline hover:no-underline">
                    support@kossem.co.il
                  </a>
                </p>
                <p>
                  📝 טופס:{" "}
                  <Link href="/contact" className="text-primary underline hover:no-underline">
                    עמוד יצירת קשר
                  </Link>
                </p>
                <p>⏰ זמן מענה: עד 3 ימי עסקים</p>
              </div>
            </section>

            {/* Acceptance */}
            <section className="mt-12 p-6 bg-purple-50 border border-purple-200 rounded-2xl">
              <p className="text-center text-purple-800 font-medium">
                בשימוש בפלטפורמה, הנך מאשר כי קראת, הבנת ואתה מסכים לכל תנאי השימוש המפורטים לעיל.
              </p>
            </section>
          </div>

          <div className="mt-12 flex gap-4">
            <Button variant="outline" asChild>
              <Link href="/" className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4" />
                חזרה לדף הבית
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/privacy">
                מדיניות פרטיות
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
