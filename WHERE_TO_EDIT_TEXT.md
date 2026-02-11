# Where to Edit Text in Webpages

This guide shows you where to edit text content for each page of the website.

## 📄 Main Pages

### 1. **Home Page (Landing Page)**
**File**: `src/app/page.tsx`
- Hero section text (lines ~70-100)
- Feature descriptions (lines ~130-350)
- Pricing plans (lines ~360-500)
- Footer text

### 2. **Dashboard Page**
**File**: `src/app/(dashboard)/dashboard/page.tsx`
- Dashboard welcome text
- Quick action cards
- Credit display text

### 3. **Credits/Subscription Page**
**File**: `src/app/credits/page.tsx`
- Credit balance display
- Subscription plan descriptions
- Pricing information

## 🎨 Generation Pages

### 4. **Text-to-Image Generation**
**File**: `src/app/(dashboard)/generate/text-to-image/page.tsx`
- Page title and description
- Button labels
- Error messages

### 5. **Carousel Generation**
**File**: `src/app/(dashboard)/generate/carousel/page.tsx`
- Form labels
- Template descriptions
- Instructions text

### 6. **Caricature/Cartoonize**
**File**: `src/app/(dashboard)/generate/cartoonize/page.tsx`
- Page title
- Form labels
- Tips and instructions

### 7. **Character Generation**
**File**: `src/app/(dashboard)/generate/character/page.tsx`
- Character creation form
- Instructions

### 8. **Character Video**
**File**: `src/app/(dashboard)/generate/character-video/page.tsx`
- Video generation form
- Scene descriptions

### 9. **Reel Converter**
**File**: `src/app/(dashboard)/generate/reel-converter/page.tsx`
- Instructions for reel conversion
- Button labels

### 10. **Text-to-Video**
**File**: `src/app/(dashboard)/generate/text-to-video/page.tsx`
- Video generation form
- Duration options

### 11. **Image-to-Video**
**File**: `src/app/(dashboard)/generate/image-to-video/page.tsx`
- Upload instructions
- Form labels

### 12. **Video Clips**
**File**: `src/app/(dashboard)/generate/video-clips/page.tsx`
- Video slicing instructions
- Options labels

## 🔐 Authentication Pages

### 13. **Login Page**
**File**: `src/app/(auth)/login/page.tsx`
- Login form labels
- Error messages
- Links text

### 14. **Signup Page**
**File**: `src/app/(auth)/signup/page.tsx`
- Registration form
- Terms text

## 📋 Other Pages

### 15. **Contact Page**
**File**: `src/app/contact/page.tsx`
- Contact form
- Contact information

### 16. **Terms of Service**
**File**: `src/app/terms/page.tsx`
- Terms and conditions text

### 17. **Privacy Policy**
**File**: `src/app/privacy/page.tsx`
- Privacy policy content

### 18. **Gallery Page**
**File**: `src/app/(dashboard)/gallery/page.tsx`
- Gallery title
- Empty state messages

### 19. **Characters Page**
**File**: `src/app/(dashboard)/characters/page.tsx`
- Character list page
- Empty state messages

## 🧩 Shared Components

### 20. **Header/Navigation**
**File**: `src/components/layout/header.tsx`
- Navigation menu items
- User menu text

### 21. **Sidebar**
**File**: `src/components/layout/sidebar.tsx`
- Sidebar menu items
- Navigation labels

### 22. **Credit Badge**
**File**: `src/components/credits-badge.tsx`
- Credit display text

## ⚠️ Error Messages & API Responses

### 23. **API Error Messages**
**Files**: `src/app/api/**/route.ts`
- Error messages returned to users
- Validation messages

**Key API files:**
- `src/app/api/generate/carousel/route.ts` - Carousel generation errors
- `src/app/api/generate/text-to-image/route.ts` - Image generation errors
- `src/app/api/generate/cartoonize/route.ts` - Caricature errors
- `src/app/api/characters/[id]/train/route.ts` - Training errors

## 💡 Tips for Editing

1. **Search for Hebrew text**: Use Ctrl+F to search for specific Hebrew text you see on the page
2. **Look for strings in quotes**: Text content is usually in quotes like `"הטקסט שלך"`
3. **Check both page.tsx and components**: Some text might be in separate component files
4. **Error messages**: Check API route files for error messages
5. **Labels**: Form labels are usually near `<Label>` or `placeholder` attributes

## 🔍 Quick Search Examples

To find specific text:
- Search for: `"התחל בחינם"` to find "Start for free" button
- Search for: `"יצירת תמונה"` to find image generation text
- Search for: `"קרוסלה"` to find carousel-related text
