// src/lib/services/render-video.ts
const RENDER_API_URL = process.env.RENDER_API_URL || 'https://frame-extractor-oou7.onrender.com';

export interface CreateVideoOptions {
    imageUrls: string[];
    sceneDuration?: number;
    transitionStyle?: 'fade' | 'slide' | 'zoom' | 'none';
    transitionDuration?: number;
    aspectRatio?: string;
    fps?: number;
}

export interface VideoResult {
    success: boolean;
    video_base64?: string;
    video_id?: string;
    duration?: number;
    frame_count?: number;
    error?: string;
}

export async function createVideoFromImages(options: CreateVideoOptions): Promise<VideoResult> {
    const response = await fetch(`${RENDER_API_URL}/create-video-from-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            image_urls: options.imageUrls,
            scene_duration: options.sceneDuration || 3,
            transition_style: options.transitionStyle || 'fade',
            transition_duration: options.transitionDuration || 0.5,
            aspect_ratio: options.aspectRatio || '9:16',
            fps: options.fps || 30,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `API error: ${error}` };
    }

    return response.json();
}

export interface AddAudioOptions {
    videoBase64: string;
    audioUrl: string;
    duration?: number;
}

export async function addAudioToVideo(options: AddAudioOptions): Promise<VideoResult & { has_audio?: boolean }> {
    const response = await fetch(`${RENDER_API_URL}/add-audio-to-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            video_base64: options.videoBase64,
            audio_url: options.audioUrl,
            duration: options.duration,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `API error: ${error}` };
    }

    return response.json();
}