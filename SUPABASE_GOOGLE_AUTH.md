# הגדרת התחברות Google ב-Supabase

> ⚠️ **אבטחה:** מומלץ ליצור Client Secret חדש ב-Google Cloud Console אם הפרטים נחשפו.

כדי לאפשר התחברות עם Google, בצע את השלבים הבאים ב-Supabase Dashboard:

## 1. פתח את פרויקט Supabase
עבור אל: https://supabase.com/dashboard/project/_/auth/providers

## 2. הפעל את Google Provider
- לחץ על **Google** ברשימת ה-Providers
- הפעל את הממתג **Enable Sign in with Google**

## 3. הזן את פרטי Google OAuth
- **Client ID:** הזן את ה-Client ID מ-Google Cloud Console
- **Client Secret:** הזן את ה-Client Secret מ-Google Cloud Console

## 4. הגדר את Redirect URI ב-Google Cloud Console
עבור אל: https://console.cloud.google.com/apis/credentials

במסך ה-OAuth 2.0 Client, הוסף ל-**Authorized redirect URIs**:
```
https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback
```
(החלף את `YOUR_SUPABASE_PROJECT_REF` ב־project reference שלך מ־Supabase Dashboard)

## 5. ודא ש-.env.local מכיל את פרטי Supabase
```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```
