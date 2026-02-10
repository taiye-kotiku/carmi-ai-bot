// src/lib/services/reel-extractor.ts
import sharp from "sharp";

interface ExtractedFrame {
    url: string;
    timestamp: number;
    quality: number;
}

/**
 * Download Instagram reel video using multiple reliable services
 * These services bypass Instagram's download protections
 */
async function downloadInstagramVideo(url: string): Promise<Buffer> {
    const downloadMethods = [
        // Method 1: Use Instagram API service (RapidAPI) if API key is available
        async () => {
            const apiKey = process.env.INSTAGRAM_API_KEY;
            if (!apiKey) throw new Error("No API key");
            
            const apiResponse = await fetch(`https://instagram-downloader-api.p.rapidapi.com/api/ig`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-RapidAPI-Key": apiKey,
                },
                body: JSON.stringify({ url }),
            });

            if (!apiResponse.ok) throw new Error(`API returned ${apiResponse.status}`);
            
            const data = await apiResponse.json();
            const videoUrl = data.video_url || data.url || data.data?.video_url || data.result?.video_url || data.video;
            
            if (!videoUrl) throw new Error("No video URL in response");
            
            console.log("Downloading video from RapidAPI:", videoUrl.substring(0, 80));
            const videoResponse = await fetch(videoUrl);
            if (!videoResponse.ok) throw new Error(`Video fetch failed: ${videoResponse.status}`);
            
            return Buffer.from(await videoResponse.arrayBuffer());
        },

        // Method 2: Use saveig.app API (free Instagram downloader)
        async () => {
            const apiResponse = await fetch(`https://saveig.app/api/ajaxSearch`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                },
                body: `q=${encodeURIComponent(url)}&t=media&lang=en`,
            });

            if (!apiResponse.ok) throw new Error(`API returned ${apiResponse.status}`);
            
            const data = await apiResponse.json();
            const videoUrl = data.medias?.[0]?.url || data.video || data.url;
            
            if (!videoUrl) throw new Error("No video URL in response");
            
            console.log("Downloading video from saveig.app:", videoUrl.substring(0, 80));
            const videoResponse = await fetch(videoUrl);
            if (!videoResponse.ok) throw new Error(`Video fetch failed: ${videoResponse.status}`);
            
            return Buffer.from(await videoResponse.arrayBuffer());
        },

        // Method 3: Use instagram-downloader APIs
        async () => {
            const apiResponse = await fetch(`https://api.saveig.app/api/ajaxSearch`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: `q=${encodeURIComponent(url)}&t=media&lang=en`,
            });

            if (!apiResponse.ok) throw new Error(`API returned ${apiResponse.status}`);
            
            const data = await apiResponse.json();
            const videoUrl = data.medias?.[0]?.url || data.video;
            
            if (!videoUrl) throw new Error("No video URL in response");
            
            console.log("Downloading video from saveig API:", videoUrl.substring(0, 80));
            const videoResponse = await fetch(videoUrl);
            if (!videoResponse.ok) throw new Error(`Video fetch failed: ${videoResponse.status}`);
            
            return Buffer.from(await videoResponse.arrayBuffer());
        },

        // Method 4: Try direct Instagram page parsing (last resort - often blocked)
        async () => {
            console.log("Attempting direct Instagram page parsing...");
            const pageResponse = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                },
            });
            
            if (!pageResponse.ok) throw new Error(`Failed to fetch page: ${pageResponse.status}`);
            
            const pageHtml = await pageResponse.text();
            
            // Try multiple patterns to find video URL
            const patterns = [
                /"video_url":"([^"]+)"/,
                /"playback_url":"([^"]+)"/,
                /property="og:video" content="([^"]+)"/,
                /"video_versions":\[{"url":"([^"]+)"/,
            ];
            
            for (const pattern of patterns) {
                const match = pageHtml.match(pattern);
                if (match && match[1]) {
                    let videoUrl = match[1]
                        .replace(/\\u0026/g, "&")
                        .replace(/\\\//g, "/")
                        .replace(/\\"/g, '"');
                    
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
                    
                    try {
                        new URL(videoUrl);
                        console.log("Found video URL:", videoUrl.substring(0, 80));
                        
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
                        continue;
                    }
                }
            }
            
            throw new Error("Could not extract video URL from page");
        },
    ];

    // Try each method in sequence
    for (let i = 0; i < downloadMethods.length; i++) {
        try {
            console.log(`Trying download method ${i + 1}...`);
            const videoBuffer = await downloadMethods[i]();
            console.log(`Successfully downloaded video using method ${i + 1}: ${videoBuffer.length} bytes`);
            return videoBuffer;
        } catch (error: any) {
            console.warn(`Download method ${i + 1} failed:`, error?.message || String(error));
            if (i === downloadMethods.length - 1) {
                // Last method failed, throw error
                throw new Error(
                    `All download methods failed. Instagram may be blocking downloads. ` +
                    `Last error: ${error?.message || String(error)}`
                );
            }
            // Continue to next method
        }
    }

    throw new Error("Failed to download Instagram video");
}

/**
 * Extract frames from video using external API service or FFmpeg
 * For serverless environments, we prefer API services
 */
async function extractFramesFromVideo(videoBuffer: Buffer, frameCount: number = 20): Promise<Buffer[]> {
    try {
        // Option 1: Use RENDER_API_URL service (frame-extractor service)
        let renderApiUrl: string = process.env.RENDER_API_URL || "";
        
        // Ensure we have a valid URL - check for undefined, null, empty string, or string "undefined"
        if (!renderApiUrl || 
            typeof renderApiUrl !== "string" || 
            renderApiUrl.trim() === "" || 
            renderApiUrl.toLowerCase() === "undefined" ||
            renderApiUrl.toLowerCase() === "null") {
            renderApiUrl = "https://frame-extractor-oou7.onrender.com";
            console.log("Using default RENDER_API_URL:", renderApiUrl);
        } else {
            // Remove trailing slash if present
            renderApiUrl = renderApiUrl.trim().replace(/\/$/, "");
        }
        
        // Validate URL format BEFORE using it
        let validatedUrl: string;
        try {
            const urlObj = new URL(renderApiUrl);
            validatedUrl = urlObj.origin + urlObj.pathname.replace(/\/$/, "");
            console.log(`Using render API URL: ${validatedUrl}`);
        } catch (urlError) {
            console.error(`Invalid RENDER_API_URL: ${renderApiUrl}`, urlError);
            // Use default if invalid
            validatedUrl = "https://frame-extractor-oou7.onrender.com";
            console.log("Falling back to default URL:", validatedUrl);
        }
        
        // Try multiple possible endpoints
        const endpoints = ["/extract-frames", "/extract-reel", "/frames"];
        
        for (const endpoint of endpoints) {
            try {
                // Construct full URL safely
                const fullUrl = `${validatedUrl}${endpoint}`;
                console.log(`Trying endpoint: ${fullUrl}`);
                
                // Validate the full URL before fetching
                try {
                    new URL(fullUrl);
                } catch {
                    console.warn(`Invalid full URL: ${fullUrl}`);
                    continue;
                }
                
                // Convert video buffer to base64
                const videoBase64 = videoBuffer.toString("base64");
                
                const response = await fetch(fullUrl, {
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
            } catch (apiError: any) {
                const errorMsg = apiError?.message || String(apiError);
                // Don't log "Failed to parse URL" errors for 404s, just continue
                if (!errorMsg.includes("Failed to parse URL")) {
                    console.warn(`Frame extraction API ${endpoint} failed:`, errorMsg);
                }
                // Continue to next endpoint
            }
        }

        // Option 2: Try FRAME_EXTRACTOR_API_URL if set
        const extractorApi = process.env.FRAME_EXTRACTOR_API_URL;
        if (extractorApi && extractorApi.trim() !== "" && extractorApi !== "undefined") {
            try {
                // Validate URL
                let apiUrl = extractorApi.trim().replace(/\/$/, "");
                try {
                    new URL(apiUrl);
                } catch {
                    console.warn(`Invalid FRAME_EXTRACTOR_API_URL: ${apiUrl}`);
                    throw new Error("Invalid FRAME_EXTRACTOR_API_URL");
                }
                
                apiUrl = apiUrl.endsWith("/") 
                    ? `${apiUrl}extract-frames` 
                    : `${apiUrl}/extract-frames`;
                
                console.log(`Trying alternative API: ${apiUrl}`);
                
                const formData = new FormData();
                // Convert Buffer to Uint8Array for Blob compatibility
                const uint8Array = new Uint8Array(videoBuffer);
                const blob = new Blob([uint8Array], { type: "video/mp4" });
                formData.append("video", blob, "video.mp4");
                formData.append("frame_count", String(frameCount * 2));

                const response = await fetch(apiUrl, {
                    method: "POST",
                    body: formData,
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.frames && Array.isArray(data.frames)) {
                        console.log("Successfully extracted frames using alternative API");
                        return data.frames.map((f: string) => Buffer.from(f, "base64"));
                    }
                }
            } catch (apiError: any) {
                const errorMsg = apiError?.message || String(apiError);
                console.warn("Alternative frame extraction API failed:", errorMsg);
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
