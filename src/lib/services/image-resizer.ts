// Service for resizing images to different social media formats
export type ExportFormat = "instagram-reel" | "instagram-post" | "instagram-story" | "tiktok";

export interface FormatDimensions {
    width: number;
    height: number;
    name: string;
    aspectRatio: string;
}

export const FORMAT_DIMENSIONS: Record<ExportFormat, FormatDimensions> = {
    "instagram-reel": {
        width: 1080,
        height: 1920,
        name: "Instagram Reel",
        aspectRatio: "9:16",
    },
    "instagram-post": {
        width: 1080,
        height: 1080,
        name: "Instagram Post",
        aspectRatio: "1:1",
    },
    "instagram-story": {
        width: 1080,
        height: 1920,
        name: "Instagram Story",
        aspectRatio: "9:16",
    },
    "tiktok": {
        width: 1080,
        height: 1920,
        name: "TikTok",
        aspectRatio: "9:16",
    },
};

/**
 * Resize an image to a specific format
 */
export async function resizeImageToFormat(
    imageUrl: string,
    format: ExportFormat
): Promise<Blob> {
    const dimensions = FORMAT_DIMENSIONS[format];
    
    // Fetch the image
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    
    // Create an image element
    const img = new Image();
    const imageBitmap = await createImageBitmap(blob);
    
    // Create canvas
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const ctx = canvas.getContext("2d");
    
    if (!ctx) {
        throw new Error("Failed to get canvas context");
    }
    
    // Calculate scaling to cover the entire canvas while maintaining aspect ratio
    const imgAspect = imageBitmap.width / imageBitmap.height;
    const canvasAspect = dimensions.width / dimensions.height;
    
    let drawWidth = dimensions.width;
    let drawHeight = dimensions.height;
    let drawX = 0;
    let drawY = 0;
    
    if (imgAspect > canvasAspect) {
        // Image is wider - fit to height
        drawHeight = dimensions.height;
        drawWidth = drawHeight * imgAspect;
        drawX = (dimensions.width - drawWidth) / 2;
    } else {
        // Image is taller - fit to width
        drawWidth = dimensions.width;
        drawHeight = drawWidth / imgAspect;
        drawY = (dimensions.height - drawHeight) / 2;
    }
    
    // Fill background with white (or black for dark images)
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);
    
    // Draw the image
    ctx.drawImage(imageBitmap, drawX, drawY, drawWidth, drawHeight);
    
    // Convert to blob
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error("Failed to convert canvas to blob"));
                }
            },
            "image/png",
            0.95
        );
    });
}

/**
 * Download resized image
 */
export async function downloadResizedImage(
    imageUrl: string,
    format: ExportFormat,
    filename?: string
): Promise<void> {
    const dimensions = FORMAT_DIMENSIONS[format];
    const blob = await resizeImageToFormat(imageUrl, format);
    
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = filename || `image-${dimensions.name.toLowerCase().replace(/\s+/g, "-")}-${dimensions.width}x${dimensions.height}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
}
