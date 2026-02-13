// src/app/api/contact/route.ts

import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
    },
});

export async function POST(request: NextRequest) {
    try {
        const { name, email, subject, message } = await request.json();

        // Validate
        if (!name || !email || !subject || !message) {
            return NextResponse.json(
                { error: "כל השדות הם חובה" },
                { status: 400 }
            );
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { error: "כתובת אימייל לא תקינה" },
                { status: 400 }
            );
        }

        const contactEmail = process.env.CONTACT_EMAIL || "kossem.yotzer@gmail.com";

        // Send email to support
        await transporter.sendMail({
            from: `"kossem - טופס יצירת קשר" <${process.env.SMTP_USER}>`,
            to: contactEmail,
            replyTo: email,
            subject: `[kossem] פנייה חדשה: ${subject}`,
            html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #7c3aed, #4f46e5); padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🧙 kossem</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">פנייה חדשה מטופס יצירת קשר</p>
          </div>
          <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #374151; width: 100px;">שם:</td>
                <td style="padding: 8px 0; color: #1f2937;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #374151;">אימייל:</td>
                <td style="padding: 8px 0;"><a href="mailto:${email}" style="color: #7c3aed;">${email}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #374151;">נושא:</td>
                <td style="padding: 8px 0; color: #1f2937;">${subject}</td>
              </tr>
            </table>
            <div style="margin-top: 16px; padding: 16px; background: white; border-radius: 8px; border: 1px solid #e5e7eb;">
              <p style="font-weight: bold; color: #374151; margin: 0 0 8px;">הודעה:</p>
              <p style="color: #1f2937; white-space: pre-wrap; margin: 0;">${message}</p>
            </div>
            <p style="margin-top: 16px; font-size: 12px; color: #9ca3af;">
              נשלח מ-kossem.co.il • ${new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}
            </p>
          </div>
        </div>
      `,
        });

        // Send confirmation to the user
        await transporter.sendMail({
            from: `"kossem" <${process.env.SMTP_USER}>`,
            to: email,
            subject: "קיבלנו את הפנייה שלך - kossem",
            html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #7c3aed, #4f46e5); padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🧙 kossem</h1>
          </div>
          <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1f2937; margin: 0 0 16px;">שלום ${name},</h2>
            <p style="color: #4b5563; line-height: 1.6;">
              תודה שפנית אלינו! קיבלנו את ההודעה שלך ונחזור אליך בהקדם האפשרי.
            </p>
            <div style="margin: 20px 0; padding: 16px; background: white; border-radius: 8px; border: 1px solid #e5e7eb;">
              <p style="font-weight: bold; color: #374151; margin: 0 0 4px;">נושא: ${subject}</p>
              <p style="color: #6b7280; margin: 0; font-size: 14px;">זמן מענה צפוי: עד 48 שעות</p>
            </div>
            <p style="color: #4b5563; line-height: 1.6;">
              בינתיים, מוזמן לבקר באתר שלנו ולהתחיל ליצור תוכן מדהים עם AI.
            </p>
            <a href="https://kossem.co.il" style="display: inline-block; margin-top: 12px; padding: 12px 24px; background: #7c3aed; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
              לאתר kossem →
            </a>
            <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">
              צוות kossem 🧙
            </p>
          </div>
        </div>
      `,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Contact form error:", error);
        return NextResponse.json(
            { error: "שליחת ההודעה נכשלה. נסה שוב מאוחר יותר." },
            { status: 500 }
        );
    }
}