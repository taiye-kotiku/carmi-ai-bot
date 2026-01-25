// src/lib/services/simple-video.ts
import { createCanvas, loadImage } from "@napi-rs/canvas";
import GifEncoder from "gif-encoder-2";

interface CreateSlideshowOptions {
    imageUrls: string[];
    width: number;
    height: number;
    frameDuration: number; // milliseconds per frame
    fadeFrames: number;
}

export async function createSlideshowGif(options: CreateSlideshowOptions): Promise<Buffer> {
    const { imageUrls, width, height, frameDuration, fadeFrames } = options;

    const encoder = new GifEncoder(width, height);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    encoder.start();
    encoder.setRepeat(0); // 0 = loop forever
    encoder.setDelay(frameDuration);
    encoder.setQuality(10);

    // Load all images
    const images = await Promise.all(
        imageUrls.map(url => loadImage(url))
    );

    for (let i = 0; i < images.length; i++) {
        const currentImage = images[i];
        const nextImage = images[(i + 1) % images.length];

        // Draw current image for most of the duration
        const holdFrames = 30; // frames to hold
        for (let f = 0; f < holdFrames; f++) {
            ctx.drawImage(currentImage, 0, 0, width, height);
            encoder.addFrame(ctx as any);
        }

        // Fade transition to next image
        if (i < images.length - 1) {
            for (let f = 0; f < fadeFrames; f++) {
                const alpha = f / fadeFrames;

                ctx.globalAlpha = 1;
                ctx.drawImage(currentImage, 0, 0, width, height);

                ctx.globalAlpha = alpha;
                ctx.drawImage(nextImage, 0, 0, width, height);

                encoder.addFrame(ctx as any);
            }
            ctx.globalAlpha = 1;
        }
    }

    encoder.finish();
    return encoder.out.getData();
}