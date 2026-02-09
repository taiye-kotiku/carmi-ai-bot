// src/lib/services/reel-extractor.ts
import sharp from "sharp";

interface ExtractedFrame {
    url: string;
    timestamp: number;
    quality: number;
}

/**
 * Download Instagram reel video using multiple methods
 */
async function downloadInstagramVideo(url: string): Promise<Buffer> {
    try {
        // Method 1: Use Instagram API service (RapidAPI)
        const apiKey = process.env.INSTAGRAM_API_KEY;
        if (apiKey) {
            try {
                // Try RapidAPI Instagram Downloader
                const apiResponse = await fetch(`https://instagram-downloader-api.p.rapidapi.com/api/ig`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-RapidAPI-Key": apiKey,
                    },
                    body: JSON.stringify({ url }),
                });

                if (apiResponse.ok) {
                    const data = await apiResponse.json();
                    const videoUrl = data.video_url || data.url || data.data?.video_url || data.result?.video_url;
                    
                    if (videoUrl) {
                        console.log("Downloading video from API:", videoUrl);
                        const videoResponse = await fetch(videoUrl);
                        if (videoResponse.ok) {
                            return Buffer.from(await videoResponse.arrayBuffer());
                        }
                    }
                }
            } catch (apiError) {
                console.warn("API service failed:", apiError);
            }
        }

        // Method 2: Use alternative Instagram downloader API
        try {
            const altApiResponse = await fetch(`https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}`);
            if (altApiResponse.ok) {
                const embedData = await altApiResponse.json();
                // Try to get video from embed data
                if (embedData.thumbnail_url) {
                    // For reels, we need the actual video URL
                    // This is a fallback - might not work for all cases
                }
            }
        } catch {}

        // Method 3: Extract video URL from Instagram page HTML
        console.log("Attempting to extract video URL from page HTML...");
        const pageResponse = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            },
        });
        
        if (!pageResponse.ok) {
            throw new Error(`Failed to fetch Instagram page: ${pageResponse.status}`);
        }
        
        const pageHtml = await pageResponse.text();
        
        // Try multiple patterns to find video URL
        const patterns = [
            /"video_url":"([^"]+)"/,
            /"playback_url":"([^"]+)"/,
            /property="og:video" content="([^"]+)"/,
            /src="([^"]*\.mp4[^"]*)"/,
            /video_url":"([^"]+\.mp4[^"]*)"/,
            /"video_versions":\[{"url":"([^"]+)"/,
        ];
        
        for (const pattern of patterns) {
            const match = pageHtml.match(pattern);
            if (match && match[1]) {
                let videoUrl = match[1]
                    .replace(/\\u0026/g, "&")
                    .replace(/\\\//g, "/")
                    .replace(/\\"/g, '"');
                
                // Clean up URL
                if (videoUrl.includes("\\")) {
                    try {
                        videoUrl = JSON.parse(`"${videoUrl}"`);
                    } catch {}
                }
                
                if (!videoUrl.startsWith("http")) {
                    if (videoUrl.startsWith("//")) {
                        videoUrl = `https:${videoUrl}`;
                    } else if (videoUrl.startsWith("/")) {
                        videoUrl = `https://instagram.com${videoUrl}`;
                    }
                }
                
                // Validate URL
                try {
                    new URL(videoUrl);
                    console.log("Found video URL:", videoUrl.substring(0, 100) + "...");
                    
                    const videoResponse = await fetch(videoUrl, {
                        headers: {
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                            "Referer": "https://www.instagram.com/",
                        },
                    });
                    
                    if (videoResponse.ok) {
                        return Buffer.from(await videoResponse.arrayBuffer());
                    }
                } catch (fetchError) {
                    console.warn("Failed to fetch video URL:", videoUrl.substring(0, 50));
                    continue;
                }
            }
        }

        throw new Error("Could not extract video URL from Instagram page. Please ensure the reel is public.");
    } catch (error) {
        console.error("Error downloading Instagram video:", error);
        throw new Error(`Failed to download video: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Extract frames from video using external API service or FFmpeg
 * For serverless environments, we prefer API services
 */
async function extractFramesFromVideo(videoBuffer: Buffer, frameCount: number = 20): Promise<Buffer[]> {
    try {
        // Option 1: Use RENDER_API_URL service (frame-extractor service)
        const renderApiUrl = process.env.RENDER_API_URL || "https://frame-extractor-oou7.onrender.com";
        
        // Try multiple possible endpoints
        const endpoints = ["/extract-frames", "/extract-reel", "/frames"];
        
        for (const endpoint of endpoints) {
            try {
                // Convert video buffer to base64
                const videoBase64 = videoBuffer.toString("base64");
                
                const response = await fetch(`${renderApiUrl}${endpoint}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        video_base64: videoBase64,
                        frame_count: frameCount * 2,
                        fps: 1, // Extract 1 frame per second
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.frames && Array.isArray(data.frames)) {
                        console.log(`Successfully extracted frames using ${endpoint}`);
                        // Convert base64 strings back to buffers
                        return data.frames.map((f: string) => {
                            // Handle both base64 strings and data URLs
                            const base64Data = f.includes(",") ? f.split(",")[1] : f;
                            return Buffer.from(base64Data, "base64");
                        });
                    }
                } else if (response.status !== 404) {
                    // If it's not a 404, log the error but try next endpoint
                    const errorText = await response.text();
                    console.warn(`Frame extraction API ${endpoint} returned ${response.status}:`, errorText);
                }
            } catch (apiError) {
                console.warn(`Frame extraction API ${endpoint} failed:`, apiError);
                // Continue to next endpoint
            }
        }

        // Option 2: Try FRAME_EXTRACTOR_API_URL if set
        const extractorApi = process.env.FRAME_EXTRACTOR_API_URL;
        if (extractorApi && extractorApi.trim() !== "") {
            try {
                const formData = new FormData();
                const blob = new Blob([videoBuffer], { type: "video/mp4" });
                formData.append("video", blob, "video.mp4");
                formData.append("frame_count", String(frameCount * 2));

                const apiUrl = extractorApi.endsWith("/") 
                    ? `${extractorApi}extract-frames` 
                    : `${extractorApi}/extract-frames`;
                
                const response = await fetch(apiUrl, {
                    method: "POST",
                    body: formData,
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.frames && Array.isArray(data.frames)) {
                        return data.frames.map((f: string) => Buffer.from(f, "base64"));
                    }
                }
            } catch (apiError) {
                console.warn("Alternative frame extraction API failed:", apiError);
            }
        }

        // Option 3: FFmpeg fallback (disabled for serverless - too heavy)
        // If both API methods fail, throw error
        throw new Error(
            "Frame extraction failed. The video processing service is unavailable. " +
            "Please ensure RENDER_API_URL is configured correctly or set FRAME_EXTRACTOR_API_URL."
        );
    } catch (error) {
        console.error("Error extracting frames:", error);
        throw new Error(`Failed to extract frames: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Calculate image quality score (sharpness, contrast, etc.)
 */
async function calculateImageQuality(imageBuffer: Buffer): Promise<number> {
    try {
        const metadata = await sharp(imageBuffer).metadata();
        const stats = await sharp(imageBuffer)
            .greyscale()
            .normalize()
            .stats();

        // Calculate sharpness (variance of laplacian approximation)
        const mean = stats.channels[0]?.mean || 0;
        const stdev = stats.channels[0]?.stdev || 0;
        
        // Higher variance = sharper image
        const sharpness = stdev * stdev;
        
        // Factor in resolution
        const resolutionScore = ((metadata.width || 0) * (metadata.height || 0)) / 1000000;
        
        // Combined quality score
        return sharpness * 0.7 + resolutionScore * 0.3;
    } catch {
        return 0;
    }
}

/**
 * Select best quality frames from extracted frames
 */
async function selectBestFrames(frames: Buffer[], count: number = 10): Promise<{ buffer: Buffer; quality: number }[]> {
    const framesWithQuality = await Promise.all(
        frames.map(async (buffer) => ({
            buffer,
            quality: await calculateImageQuality(buffer),
        }))
    );

    // Sort by quality (highest first) and take top N
    return framesWithQuality
        .sort((a, b) => b.quality - a.quality)
        .slice(0, count);
}

/**
 * Main function to extract best frames from Instagram reel
 */
export async function extractReelFrames(
    instagramUrl: string,
    frameCount: number = 10
): Promise<ExtractedFrame[]> {
    try {
        // Step 1: Download video
        console.log("Downloading Instagram video...");
        const videoBuffer = await downloadInstagramVideo(instagramUrl);
        console.log(`Downloaded video: ${videoBuffer.length} bytes`);

        // Step 2: Extract frames
        console.log("Extracting frames from video...");
        const extractedFrames = await extractFramesFromVideo(videoBuffer, frameCount * 2);
        console.log(`Extracted ${extractedFrames.length} frames`);

        // Step 3: Select best quality frames
        console.log("Selecting best quality frames...");
        const bestFrames = await selectBestFrames(extractedFrames, frameCount);
        console.log(`Selected ${bestFrames.length} best frames`);

        // Step 4: Return frames with timestamps
        return bestFrames.map((frame, index) => ({
            url: `data:image/jpeg;base64,${frame.buffer.toString("base64")}`,
            timestamp: index * 1000, // Approximate timestamp
            quality: frame.quality,
        }));
    } catch (error) {
        console.error("Error extracting reel frames:", error);
        throw error;
    }
}
