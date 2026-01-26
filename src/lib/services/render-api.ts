const RENDER_API_URL = process.env.RENDER_API_URL || 'https://frame-extractor-oou7.onrender.com';

export interface CreateSlideshowOptions {
    imageUrls: string[];
    durationPerImage?: number;
    transition?: 'fade' | 'slide' | 'zoom' | 'none';
    transitionDuration?: number;
    aspectRatio?: '9:16' | '16:9' | '1:1' | '4:5';
}

export interface SlideshowResponse {
    success: boolean;
    video_url?: string;
    video_id?: string;
    duration?: number;
    error?: string;
}

export async function createSlideshow(options: CreateSlideshowOptions): Promise<SlideshowResponse> {
    const response = await fetch(`${RENDER_API_URL}/create-slideshow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            image_urls: options.imageUrls,
            duration_per_image: options.durationPerImage || 3,
            transition: options.transition || 'fade',
            transition_duration: options.transitionDuration || 0.5,
            aspect_ratio: options.aspectRatio || '9:16',
        }),
    });

    return response.json();
}

export interface BrandImageOptions {
    imageUrl?: string;
    imageBase64?: string;
    logoUrl?: string;
    logoBase64?: string;
    position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center';
    opacity?: number;
    size?: number;
}

export interface BrandImageResponse {
    success: boolean;
    image_base64?: string;
    branded?: boolean;
    error?: string;
}

export async function brandImage(options: BrandImageOptions): Promise<BrandImageResponse> {
    const response = await fetch(`${RENDER_API_URL}/brand-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            image_url: options.imageUrl,
            image_base64: options.imageBase64,
            logo_url: options.logoUrl,
            logo_base64: options.logoBase64,
            position: options.position || 'bottom-right',
            opacity: options.opacity || 0.8,
            size: options.size || 12,
        }),
    });

    return response.json();
}

export interface CreateCarouselOptions {
    imageUrls: string[];
    logoUrl?: string;
    brandingPosition?: string;
    brandingOpacity?: number;
    brandingSize?: number;
}

export async function createBrandedCarousel(options: CreateCarouselOptions): Promise<string[]> {
    const brandedImages: string[] = [];

    for (const imageUrl of options.imageUrls) {
        if (options.logoUrl) {
            const result = await brandImage({
                imageUrl,
                logoUrl: options.logoUrl,
                position: (options.brandingPosition as BrandImageOptions['position']) || 'bottom-right',
                opacity: options.brandingOpacity || 0.8,
                size: options.brandingSize || 12,
            });

            if (result.success && result.image_base64) {
                brandedImages.push(`data:image/jpeg;base64,${result.image_base64}`);
            } else {
                brandedImages.push(imageUrl); // Fallback to original
            }
        } else {
            brandedImages.push(imageUrl);
        }
    }

    return brandedImages;
}