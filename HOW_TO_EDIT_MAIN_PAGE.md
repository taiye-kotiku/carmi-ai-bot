# מדריך לעריכת עמוד הבית הראשי

קובץ: `src/app/page.tsx`

## 🎬 עריכת גודל הווידאו

### מיקום: שורה 322

```tsx
<div className="relative aspect-video bg-slate-800/50 overflow-hidden">
```

**אפשרויות לשינוי:**

1. **שינוי יחס גובה-רוחב:**
   - `aspect-video` (16:9) - ברירת מחדל
   - `aspect-square` (1:1) - ריבוע
   - `aspect-[4/5]` (4:5) - אינסטגרם Story
   - `aspect-[9/16]` (9:16) - אינסטגרם Reel / TikTok

2. **שינוי גובה/רוחב מותאם:**
   ```tsx
   <div className="relative h-[400px] w-full bg-slate-800/50 overflow-hidden">
   ```

3. **שינוי גודל הווידאו עצמו (שורה 329):**
   ```tsx
   className="w-full h-full object-cover"
   ```
   אפשרויות:
   - `object-cover` - מכסה את כל האזור (חותך קצוות)
   - `object-contain` - מציג את כל הווידאו (עם רווחים)
   - `object-fill` - מותח את הווידאו למלא את האזור

---

## 🎨 עריכת צבעי העמוד

### 1. רקע ראשי (שורה 62)
```tsx
<div className="min-h-screen bg-slate-950 text-slate-50 ...">
```
- `bg-slate-950` - רקע כהה
- אפשר לשנות ל: `bg-gray-900`, `bg-black`, `bg-indigo-950`, וכו'

### 2. אפקטי רקע (שורות 65-66)
```tsx
<div className="... bg-purple-600/20 ..." />  // שורה 65
<div className="... bg-indigo-600/20 ..." />  // שורה 66
```
- שינוי צבעי האפקטים: `purple-600`, `indigo-600`, `pink-600`, וכו'

### 3. כותרת עליונה (שורה 72)
```tsx
<header className="... bg-slate-950/60 backdrop-blur-xl">
```
- `bg-slate-950/60` - רקע שקוף
- אפשר לשנות ל: `bg-indigo-950/80`, `bg-purple-950/70`, וכו'

### 4. כפתורים וקישורים (שורות 102, 124, 398)
```tsx
// שורה 102 - כפתור "התחל בחינם"
className="bg-gradient-to-r from-indigo-600 to-purple-600 ..."

// שורה 124 - כותרת עם גרדיאנט
className="bg-clip-text text-transparent bg-gradient-to-l from-indigo-400 via-purple-400 to-cyan-400 ..."

// שורה 398 - כפתור CTA
className="bg-gradient-to-r from-indigo-600 to-purple-600 ..."
```

**דוגמאות לשינוי צבעים:**
- כחול-סגול: `from-blue-600 to-purple-600`
- ורוד-מגנטה: `from-pink-600 to-rose-600`
- ירוק-טורקיז: `from-emerald-600 to-cyan-600`

### 5. כרטיסי תכונות (שורות 180, 200, 215, 230, 245)
```tsx
// שורה 180 - כרטיס תמונות
hover:border-indigo-500/50

// שורה 200 - כרטיס רילז
hover:border-pink-500/50

// שורה 215 - כרטיס דמות
hover:border-cyan-500/50

// שורה 230 - כרטיס וידאו
hover:border-amber-500/50

// שורה 245 - כרטיס קרוסלה
hover:border-emerald-500/50
```

### 6. סעיף גלריה (שורה 264)
```tsx
<div className="... bg-indigo-600/10 ..." />
```

### 7. תגיות (Badges) - שורות 117, 268, 335
```tsx
// שורה 117
border-indigo-500/30 bg-indigo-500/10 text-indigo-300

// שורה 268
border-purple-500/30 bg-purple-500/10 text-purple-300

// שורה 335
bg-amber-500/10 text-amber-400 border-amber-500/30
```

### 8. כרטיסי תמחור (שורות 418, 437, 463)
```tsx
// שורה 418 - תוכנית חינם
bg-white/5 border-white/10

// שורה 437 - תוכנית פופולרית
bg-indigo-600/10 border-indigo-500/50

// שורה 463 - תוכנית מקצוען
bg-white/5 border-white/10
```

---

## 📝 דוגמאות לשינויים נפוצים

### שינוי כל הצבעים מכחול-סגול לוורוד-מגנטה:

1. **שורה 62:** `bg-slate-950` → `bg-slate-950` (נשאר)
2. **שורה 65:** `bg-purple-600/20` → `bg-pink-600/20`
3. **שורה 66:** `bg-indigo-600/20` → `bg-rose-600/20`
4. **שורה 102:** `from-indigo-600 to-purple-600` → `from-pink-600 to-rose-600`
5. **שורה 124:** `from-indigo-400 via-purple-400 to-cyan-400` → `from-pink-400 via-rose-400 to-fuchsia-400`
6. **שורה 180:** `hover:border-indigo-500/50` → `hover:border-pink-500/50`
7. **שורה 117:** `border-indigo-500/30 bg-indigo-500/10 text-indigo-300` → `border-pink-500/30 bg-pink-500/10 text-pink-300`

### שינוי גודל וידאו לריבוע:

**שורה 322:**
```tsx
// לפני:
<div className="relative aspect-video bg-slate-800/50 overflow-hidden">

// אחרי:
<div className="relative aspect-square bg-slate-800/50 overflow-hidden">
```

### שינוי גודל וידאו ל-Reel (9:16):

**שורה 322:**
```tsx
<div className="relative aspect-[9/16] bg-slate-800/50 overflow-hidden">
```

---

## 💡 טיפים

1. **שימוש ב-Tailwind CSS:** כל הצבעים משתמשים ב-Tailwind, כך שאפשר להשתמש בכל צבעי Tailwind הזמינים
2. **שקיפות:** `/20`, `/50`, `/80` מייצגים רמת שקיפות (20%, 50%, 80%)
3. **גרדיאנטים:** `from-X to-Y` יוצר מעבר צבעים מ-X ל-Y
4. **בדיקה:** לאחר שינוי, רענן את הדף כדי לראות את השינויים

---

## 🔍 חיפוש מהיר

לחיפוש כל המופעים של צבע מסוים בקובץ:
- לחץ `Ctrl+F` (או `Cmd+F` ב-Mac)
- חפש: `indigo`, `purple`, `pink`, וכו'
