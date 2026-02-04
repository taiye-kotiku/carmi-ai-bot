"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Bot,
    Image as ImageIcon,
    Video,
    MessageCircle,
    HelpCircle,
    FileQuestion,
    Users
} from "lucide-react";

export default function HelpPage() {
    const features = [
        {
            title: "יצירת דמויות",
            description: "אמנו דמויות AI משלכם",
            icon: <Users className="h-6 w-6 text-purple-500" />,
            content: "העלו תמונות פנים ברורות כדי לאמן דמות חדשה. לאחר האימון, תוכלו להשתמש בדמות בכל כלי היצירה שלנו."
        },
        {
            title: "מחולל תמונות",
            description: "טקסט לתמונה איכותית",
            icon: <ImageIcon className="h-6 w-6 text-blue-500" />,
            content: "כתבו תיאור מפורט של מה שתרצו לראות. ניתן לבחור סגנונות שונים ולהשתמש בדמויות המאומנות שלכם."
        },
        {
            title: "סטודיו וידאו",
            description: "הנפשת תמונות וסרטונים",
            icon: <Video className="h-6 w-6 text-pink-500" />,
            content: "הפכו תמונה לסרטון, או יצרו סרטון מטקסט. תומך גם ביצירת סרטוני רילז לאינסטגרם ולטיקטוק."
        },
        {
            title: "צ'אט בוט",
            description: "שיחה עם דמויות",
            icon: <MessageCircle className="h-6 w-6 text-green-500" />,
            content: "שוחחו עם הדמויות שיצרתם או עם דמויות מובנות. הדמויות זוכרות את ההקשר ומגיבות בהתאם לאופי שלהן."
        }
    ];

    const faqs = [
        {
            question: "איך עובדת שיטת הקרדיטים?",
            answer: "כל פעולה במערכת (יצירת תמונה, וידאו, אימון דמות) עולה כמות מסוימת של קרדיטים. ניתן לרכוש חבילות קרדיטים דרך דף ההגדרות."
        },
        {
            question: "האם התמונות שלי פרטיות?",
            answer: "כן, כל התמונות והדמויות שאתם יוצרים הן פרטיות וחשופות רק לכם, אלא אם כן בחרתם לשתף אותן."
        },
        {
            question: "מהן הדרישות לאימון דמות מוצלח?",
            answer: "מומלץ להעלות 10-20 תמונות ברורות של הפנים, מזוויות שונות ובתאורה טובה. הימנעו מתמונות מטושטשות או קבוצתיות."
        },
        {
            question: "האם אני יכול למחוק את החשבון שלי?",
            answer: "כן, ניתן למחוק את החשבון וכל המידע הנלווה אליו דרך עמוד ההגדרות."
        }
    ];

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            <div className="flex items-center space-x-4 space-x-reverse">
                <div className="p-3 bg-primary/10 rounded-full">
                    <HelpCircle className="h-8 w-8 text-primary" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">מרכז עזרה</h1>
                    <p className="text-muted-foreground mt-1">
                        כל המידע שצריך כדי להתחיל ליצור ב-Hebrew AI Bot
                    </p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {features.map((feature, index) => (
                    <Card key={index} className="hover:shadow-lg transition-shadow duration-200">
                        <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-2">
                            <div className="p-2 bg-muted rounded-full">
                                {feature.icon}
                            </div>
                            <div className="space-y-1">
                                <CardTitle className="text-xl">{feature.title}</CardTitle>
                                <CardDescription>{feature.description}</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-gray-600 leading-relaxed">
                                {feature.content}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card className="md:col-span-2">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <FileQuestion className="h-5 w-5 text-primary" />
                            <CardTitle>שאלות נפוצות</CardTitle>
                        </div>
                        <CardDescription>
                            תשובות לשאלות ששואלים אותנו בדרך כלל
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {faqs.map((faq, index) => (
                            <div key={index} className="border-b last:border-0 pb-4 last:pb-0">
                                <h3 className="font-medium text-base mb-2 flex items-center gap-2">
                                    <span className="text-primary">•</span>
                                    {faq.question}
                                </h3>
                                <p className="text-sm text-muted-foreground pr-4">
                                    {faq.answer}
                                </p>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Bot className="h-5 w-5 text-primary" />
                            <CardTitle>תמיכה</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm">
                            נתקלתם בבעיה? יש לכם רעיון לפיצ'ר חדש?
                            אנחנו כאן בשבילכם!
                        </p>
                        <div className="space-y-2">
                            <p className="text-sm font-medium">ערוצי תקשורת:</p>
                            <ul className="text-sm space-y-2 text-muted-foreground">
                                <li className="flex items-center gap-2">
                                    <span>📧</span>
                                    <a href="mailto:support@hebrewai.bot" className="hover:underline text-primary">
                                        support@hebrewai.bot
                                    </a>
                                </li>
                                <li className="flex items-center gap-2">
                                    <span>💬</span>
                                    <a href="#" className="hover:underline text-primary">
                                        קבוצת הטלגרם שלנו
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
