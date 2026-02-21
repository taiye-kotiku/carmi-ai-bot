# Deployment Guide

## Phase 4: Integration Testing & Deployment

### Prerequisites

- Node.js 18+
- Supabase project (auth, credits, jobs, generations tables)
- Environment variables: `GOOGLE_AI_API_KEY`, Supabase keys

### Build & Test

```bash
npm install
npm run build
npm run lint
```

### Integration Tests (Manual)

1. **Creative Hub**
   - Go to `/generate/creative-hub`
   - Enter prompt, select Story + Image
   - Verify jobs run, results appear
   - Close tab, reopen – verify sessionStorage restores polling

2. **Text-to-Video (15s)**
   - Go to `/generate/text-to-video`
   - Select 15 seconds, generate
   - Verify video completes (8s or 15s if extend works)

3. **Credits**
   - Verify deduct-before-generation
   - Verify refund on failed job

4. **Mobile**
   - Test on mobile viewport
   - Verify 44px touch targets, credits in header

### Environment Notes

- **Veo Extension**: Uses same Veo model with `video` parameter. May require Vertex AI if Gemini API doesn't support extend.
- **ffmpeg Burn-in**: `subtitle-burn.ts` requires ffmpeg binary. Vercel serverless does NOT include ffmpeg. Use:
  - Docker/VM with ffmpeg
  - Cloud Run / Cloud Functions with ffmpeg
  - Third-party subtitle API
- **Transcription**: Gemini video transcription works on Gemini API. Enable via `ENABLE_VIDEO_TRANSCRIPTION=true` when wired to jobs.

### Vercel Deployment

1. Connect repo to Vercel
2. Set env vars in Vercel dashboard
3. Deploy – `npm run build` must pass
4. Note: Veo extend and ffmpeg burn-in may need separate backend

### Docker (with ffmpeg)

```dockerfile
FROM node:20-slim
RUN apt-get update && apt-get install -y ffmpeg
COPY . .
RUN npm ci --omit=dev
CMD ["npm", "start"]
```
