"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function SignUpPage() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        name,
                    },
                },
            });

            if (error) {
                toast.error(error.message);
                return;
            }

            if (data.user) {
                toast.success("!נרשמת בהצלחה");
                router.push("/dashboard");
                router.refresh();
            }
        } catch (error) {
            toast.error("שגיאה בהרשמה");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
                <h1 className="text-2xl font-bold mb-2">צור חשבון חדש 🚀</h1>
                <p className="text-gray-600">התחל ליצור תוכן מדהים עם AI</p>
            </div>

            <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="name">שם</Label>
                    <Input
                        id="name"
                        type="text"
                        placeholder="השם שלך"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="email">אימייל</Label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        dir="ltr"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="password">סיסמה</Label>
                    <Input
                        id="password"
                        type="password"
                        placeholder="לפחות 6 תווים"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        dir="ltr"
                    />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin ml-2" />
                            נרשם...
                        </>
                    ) : (
                        "צור חשבון"
                    )}
                </Button>
            </form>

            <p className="text-center text-sm text-gray-600 mt-6">
                יש לך כבר חשבון?{" "}
                <Link href="/login" className="text-blue-600 hover:underline font-medium">
                    התחבר
                </Link>
            </p>

            <p className="text-center text-xs text-gray-400 mt-4">
                בהרשמה אתה מסכים ל
                <Link href="/terms" className="underline">תנאי השימוש</Link>
                {" "}ול
                <Link href="/privacy" className="underline">מדיניות הפרטיות</Link>
            </p>
        </div>
    );
}