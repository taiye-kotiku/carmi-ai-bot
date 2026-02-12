# Video Processor Service

Python Flask service for video processing with MediaPipe. This service handles:
- Extracting best frames from videos using selfie segmentation
- Merging videos with background images

## Setup

1. Install dependencies:
```bash
pip install -r service-requirements.txt
```

2. Run the service:
```bash
python scripts/video-processor-service.py
```

The service will run on `http://localhost:5000`

## Deploy to Render/Railway/etc.

1. Create a new Web Service on Render
2. Set build command: `pip install -r scripts/service-requirements.txt`
3. Set start command: `python scripts/video-processor-service.py`
4. Add environment variable `PORT=5000` (if needed)
5. Copy the service URL and add it to Vercel environment variables as `VIDEO_PROCESSOR_API_URL`

## API Endpoints

### POST /process-video

**Extract frames:**
```json
{
  "action": "extract_frames",
  "video_base64": "...",
  "image_count": 10
}
```

**Merge video:**
```json
{
  "action": "merge_video",
  "video_base64": "...",
  "background_base64": "..."
}
```

## Environment Variables

In your Vercel project, add:
- `VIDEO_PROCESSOR_API_URL`: URL of your deployed Python service (e.g., `https://video-processor.onrender.com`)
