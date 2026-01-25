// src/lib/services/ffmpeg-video.ts
import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { nanoid } from "nanoid";

interface CreateVideoOptions {
    imageUrls: string[];
    outputPath: string;
    sceneDuration: number; // seconds per image
    transitionDuration?: number; // seconds for transition
    transitionStyle: "fade" | "slide" | "zoom" | "none";
    aspectRatio: string;
    fps?: number;
}

interface VideoResult {
    outputPath: string;
    duration: number;
}

// Get dimensions from aspect ratio
function getVideoDimensions(aspectRatio: string): { width: number; height: number } {
    const dimensions: Record<string, { width: number; height: number }> = {
        "9:16": { width: 1080, height: 1920 },
        "16:9": { width: 1920, height: 1080 },
        "1:1": { width: 1080, height: 1080 },
        "4:5": { width: 1080, height: 1350 },
    };
    return dimensions[aspectRatio] || dimensions["9:16"];
}

// Download image to temp file
async function downloadToTemp(url: string, filename: string): Promise<string> {
    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());
    const tempPath = path.join(os.tmpdir(), filename);
    await fs.writeFile(tempPath, buffer);
    return tempPath;
}

// Create video from images using FFmpeg
export async function createVideoFromImages(options: CreateVideoOptions): Promise<VideoResult> {
    const {
        imageUrls,
        outputPath,
        sceneDuration,
        transitionDuration = 0.5,
        transitionStyle,
        aspectRatio,
        fps = 30,
    } = options;

    const { width, height } = getVideoDimensions(aspectRatio);
    const tempDir = path.join(os.tmpdir(), `video-${nanoid()}`);

    // Create temp directory
    await fs.mkdir(tempDir, { recursive: true });

    try {
        // Download all images to temp directory
        const localPaths: string[] = [];
        for (let i = 0; i < imageUrls.length; i++) {
            const ext = imageUrls[i].split('.').pop()?.split('?')[0] || 'png';
            const localPath = path.join(tempDir, `image_${String(i).padStart(3, '0')}.${ext}`);

            const response = await fetch(imageUrls[i]);
            const buffer = Buffer.from(await response.arrayBuffer());
            await fs.writeFile(localPath, buffer);
            localPaths.push(localPath);
        }

        // Calculate total duration
        const totalDuration = imageUrls.length * sceneDuration;

        // Build FFmpeg command based on transition style
        return await new Promise<VideoResult>((resolve, reject) => {
            let command = ffmpeg();

            if (transitionStyle === "none") {
                // Simple concatenation without transitions
                const inputListPath = path.join(tempDir, "input.txt");
                const inputList = localPaths
                    .map(p => `file '${p}'\nduration ${sceneDuration}`)
                    .join("\n");

                // Write input list synchronously for simplicity
                require('fs').writeFileSync(inputListPath, inputList + `\nfile '${localPaths[localPaths.length - 1]}'`);

                command = ffmpeg()
                    .input(inputListPath)
                    .inputOptions(["-f", "concat", "-safe", "0"])
                    .outputOptions([
                        `-vf`, `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`,
                        `-c:v`, `libx264`,
                        `-pix_fmt`, `yuv420p`,
                        `-r`, `${fps}`,
                    ]);
            } else if (transitionStyle === "fade") {
                // Fade transitions using xfade filter
                localPaths.forEach((p, i) => {
                    command = command.input(p).inputOptions(["-loop", "1", "-t", `${sceneDuration + transitionDuration}`]);
                });

                // Build complex filter for xfade
                const filters: string[] = [];
                let lastOutput = "0:v";

                // Scale all inputs
                localPaths.forEach((_, i) => {
                    filters.push(`[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1[v${i}]`);
                });

                // Create xfade chain
                for (let i = 0; i < localPaths.length - 1; i++) {
                    const offset = (i + 1) * sceneDuration - transitionDuration * i;
                    const outputLabel = i === localPaths.length - 2 ? "outv" : `xf${i}`;

                    if (i === 0) {
                        filters.push(`[v0][v1]xfade=transition=fade:duration=${transitionDuration}:offset=${sceneDuration - transitionDuration}[${outputLabel}]`);
                    } else {
                        filters.push(`[xf${i - 1}][v${i + 1}]xfade=transition=fade:duration=${transitionDuration}:offset=${offset - transitionDuration}[${outputLabel}]`);
                    }
                }

                if (localPaths.length === 1) {
                    filters.push(`[v0]copy[outv]`);
                }

                command = command
                    .complexFilter(filters.join(";"), "outv")
                    .outputOptions([
                        `-c:v`, `libx264`,
                        `-pix_fmt`, `yuv420p`,
                        `-r`, `${fps}`,
                    ]);
            } else if (transitionStyle === "slide") {
                // Slide transitions
                localPaths.forEach((p) => {
                    command = command.input(p).inputOptions(["-loop", "1", "-t", `${sceneDuration + transitionDuration}`]);
                });

                const filters: string[] = [];

                localPaths.forEach((_, i) => {
                    filters.push(`[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1[v${i}]`);
                });

                for (let i = 0; i < localPaths.length - 1; i++) {
                    const offset = (i + 1) * sceneDuration - transitionDuration * i;
                    const outputLabel = i === localPaths.length - 2 ? "outv" : `xf${i}`;

                    if (i === 0) {
                        filters.push(`[v0][v1]xfade=transition=slideleft:duration=${transitionDuration}:offset=${sceneDuration - transitionDuration}[${outputLabel}]`);
                    } else {
                        filters.push(`[xf${i - 1}][v${i + 1}]xfade=transition=slideleft:duration=${transitionDuration}:offset=${offset - transitionDuration}[${outputLabel}]`);
                    }
                }

                if (localPaths.length === 1) {
                    filters.push(`[v0]copy[outv]`);
                }

                command = command
                    .complexFilter(filters.join(";"), "outv")
                    .outputOptions([
                        `-c:v`, `libx264`,
                        `-pix_fmt`, `yuv420p`,
                        `-r`, `${fps}`,
                    ]);
            } else if (transitionStyle === "zoom") {
                // Ken Burns style zoom effect
                localPaths.forEach((p) => {
                    command = command.input(p).inputOptions(["-loop", "1", "-t", `${sceneDuration}`]);
                });

                const filters: string[] = [];

                // Add zoom effect to each image
                localPaths.forEach((_, i) => {
                    filters.push(`[${i}:v]scale=${width * 1.2}:${height * 1.2},zoompan=z='min(zoom+0.0015,1.2)':d=${sceneDuration * fps}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${height}[v${i}]`);
                });

                // Concatenate
                const concatInputs = localPaths.map((_, i) => `[v${i}]`).join("");
                filters.push(`${concatInputs}concat=n=${localPaths.length}:v=1:a=0[outv]`);

                command = command
                    .complexFilter(filters.join(";"), "outv")
                    .outputOptions([
                        `-c:v`, `libx264`,
                        `-pix_fmt`, `yuv420p`,
                        `-r`, `${fps}`,
                    ]);
            }

            command
                .output(outputPath)
                .on("end", () => {
                    resolve({
                        outputPath,
                        duration: totalDuration,
                    });
                })
                .on("error", (err) => {
                    console.error("FFmpeg error:", err);
                    reject(err);
                })
                .run();
        });
    } finally {
        // Clean up temp directory
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch (e) {
            console.warn("Failed to clean up temp directory:", e);
        }
    }
}

// Add audio to video
export async function addAudioToVideo(
    videoPath: string,
    audioUrl: string,
    outputPath: string,
    videoDuration: number
): Promise<string> {
    const tempDir = path.join(os.tmpdir(), `audio-${nanoid()}`);
    await fs.mkdir(tempDir, { recursive: true });

    try {
        // Download audio
        const audioPath = path.join(tempDir, "audio.mp3");
        const response = await fetch(audioUrl);
        const buffer = Buffer.from(await response.arrayBuffer());
        await fs.writeFile(audioPath, buffer);

        return await new Promise<string>((resolve, reject) => {
            ffmpeg()
                .input(videoPath)
                .input(audioPath)
                .outputOptions([
                    "-c:v", "copy",
                    "-c:a", "aac",
                    "-shortest",
                    "-map", "0:v:0",
                    "-map", "1:a:0",
                    `-t`, `${videoDuration}`,
                ])
                .output(outputPath)
                .on("end", () => resolve(outputPath))
                .on("error", reject)
                .run();
        });
    } finally {
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch (e) {
            console.warn("Failed to clean up temp directory:", e);
        }
    }
}