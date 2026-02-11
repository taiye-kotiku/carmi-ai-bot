# Where to Edit Backend Code

This guide shows you where to edit backend logic, API routes, and business rules.

## 🔌 API Routes (Backend Endpoints)

All API routes are in: `src/app/api/`

### Carousel Generation
**File**: `src/app/api/generate/carousel/route.ts`
- **Line 44**: Validation for `customSlides.length` - checks if slides are provided
- **Line 26**: Receives `customSlides` from frontend
- **Line 128**: Passes `customSlides` to processing function
- **Line 84**: Credit deduction logic
- **Line 154-226**: `processCarousel` function - main processing logic

### Text-to-Image Generation
**File**: `src/app/api/generate/text-to-image/route.ts`
- Image generation logic
- Credit checking and deduction
- Image processing and storage

### Caricature/Cartoonize
**File**: `src/app/api/generate/cartoonize/route.ts`
- Image analysis with Gemini Vision
- Caricature generation logic
- Credit deduction

### Character Training
**File**: `src/app/api/characters/[id]/train/route.ts`
- LoRA training initiation
- Credit checking (line 56: `TRAINING_COST = 50`)
- Training job submission

### Character Image Generation
**File**: `src/app/api/characters/[id]/image/route.ts`
- Character image generation with LoRA
- Credit deduction

### Character Video Generation
**File**: `src/app/api/generate/character-video/route.ts`
- Video generation with character LoRA
- Credit checking (lines 62-63: image and video credits)

### Text-to-Video
**File**: `src/app/api/generate/text-to-video/route.ts`
- Video generation logic
- Credit checking (line 48: `requiredCredits = 25`)

### Image-to-Video
**File**: `src/app/api/generate/image-to-video/route.ts`
- Image to video conversion
- Credit checking (line 34: `videoCost = 25`)

### Reel Converter
**File**: `src/app/api/generate/reel/route.ts`
- Instagram reel download
- Frame extraction
- Credit checking (line 49: `requiredCredits = 4`)

### Video Clips/Slicing
**File**: `src/app/api/generate/video-clips/route.ts`
- Video slicing logic
- Credit checking (line 74: `clipCost = 25`)

## 🛠️ Services (Business Logic)

All services are in: `src/lib/services/`

### Carousel Service
**File**: `src/lib/services/carousel.ts`
- Carousel generation orchestration
- Template handling
- Logo processing

### Carousel Content Generation
**File**: `src/lib/services/carousel-content.ts`
- AI content generation for carousel slides
- Uses Gemini to create slide text

### Carousel Engine
**File**: `src/lib/services/carousel-engine.ts`
- Image processing with Sharp
- Text rendering on images
- Logo placement logic
- Background handling

### Credits Service
**File**: `src/lib/services/credits.ts`
- Credit deduction logic
- Credit balance checking
- Transaction recording

### Gemini Service
**File**: `src/lib/services/gemini.ts`
- Google Gemini API integration
- Image generation
- Video generation
- Prompt enhancement

### Character Video Service
**File**: `src/lib/services/character-video.ts`
- Character video generation logic
- Scene processing
- LoRA integration

### Reel Extractor Service
**File**: `src/lib/services/reel-extractor.ts`
- Instagram reel downloading
- Frame extraction
- Quality scoring

## ⚙️ Configuration Files

### Credit Costs
**File**: `src/lib/config/credits.ts`
- Defines credit costs for each feature
- `CREDIT_COSTS` object with all pricing

### Subscription Plans
**File**: `src/lib/constants/subscription-plans.ts`
- Plan definitions (free, basic, pro)
- Credit allocations per plan

## 📊 Database Operations

### Supabase Admin
**File**: `src/lib/supabase/admin.ts`
- Admin client for database operations
- Used for credit updates, job management

### Supabase Server
**File**: `src/lib/supabase/server.ts`
- Server-side Supabase client
- Used for authenticated requests

## 🔍 Example: Finding `customSlides.length` Logic

### Frontend (UI)
**File**: `src/app/(dashboard)/generate/carousel/page.tsx`
- Line 75: `const [customSlides, setCustomSlides] = useState<string[]>([]);`
- Line 420: Validation check `customSlides.length >= 2`
- Line 1079: Display credit cost based on `customSlides.length`

### Backend (API)
**File**: `src/app/api/generate/carousel/route.ts`
- Line 26: Receives `slides: customSlides` from request body
- Line 44: Validation: `if (!topic && !customSlides?.length)`
- Line 128: Passes to processing: `customSlides`
- Line 154: Interface definition: `customSlides?: string[];`
- Line 180: Uses in processing: `let slides = options.customSlides;`

## 💡 Common Backend Edits

### 1. Change Credit Costs
**Location**: `src/lib/config/credits.ts` or directly in API route files
```typescript
// Example: Change carousel cost
const requiredCredits = 3; // Change this number
```

### 2. Change Validation Rules
**Location**: API route files, usually around line 40-50
```typescript
// Example: Require minimum 3 slides instead of 2
if (customSlides.length < 3) {
    return NextResponse.json({ error: "..." }, { status: 400 });
}
```

### 3. Change Processing Logic
**Location**: Service files in `src/lib/services/`
- Image processing: `carousel-engine.ts`
- Content generation: `carousel-content.ts`
- Video generation: `character-video.ts`

### 4. Change Error Messages
**Location**: API route files
```typescript
return NextResponse.json(
    { error: "ההודעה שלך כאן" }, // Edit this message
    { status: 400 }
);
```

### 5. Change Database Queries
**Location**: API route files or service files
```typescript
const { data, error } = await supabaseAdmin
    .from("credits")
    .select("carousel_credits")
    .eq("user_id", user.id)
    .single();
```

## 🎯 Quick Reference

| What to Edit | Where |
|--------------|-------|
| Credit costs | `src/lib/config/credits.ts` or API route files |
| Validation rules | API route files (lines ~40-80) |
| Error messages | API route files |
| Image processing | `src/lib/services/carousel-engine.ts` |
| Content generation | `src/lib/services/carousel-content.ts` |
| Video generation | `src/lib/services/character-video.ts` |
| Database queries | API route files or service files |
| Credit deduction | `src/lib/services/credits.ts` |

## 🔧 Tips

1. **API Routes**: Handle HTTP requests, validation, and credit checks
2. **Services**: Contain reusable business logic
3. **Validation**: Usually at the start of API route handlers
4. **Credit Logic**: Check at the beginning, deduct after success
5. **Error Handling**: Use try-catch blocks in async functions
