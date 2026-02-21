// src/lib/services/subtitle-burn.ts
// Burn Hebrew subtitles into video using ffmpeg
// NOTE: Requires ffmpeg binary. Vercel serverless does NOT include ffmpeg.
// Use this in Docker, a VM, or a service that has ffmpeg installed.

import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import type { SRTEntry } from "./video-transcription";
import { srtEntriesToSrt } from "./video-transcription";

const execAsync = promisify(exec);

export async function burnSubtitlesIntoVideo(
    inputVideoPath: string,
    srtEntries: SRTEntry[],
    outputPath: string,
    options?: { highlightWords?: boolean }
): Promise<void> {
    const tmpDir = await mkdtemp(join(tmpdir(), "subs-"));
    const srtPath = join(tmpDir, "subs.srt");

    const srtContent = srtEntriesToSrt(srtEntries);
    await writeFile(srtPath, srtContent, "utf-8");

    // Escape special chars for ffmpeg filter
    const escapedSrt = srtPath.replace(/\\/g, "/").replace(/:/g, "\\:");

    // Hebrew-compatible font (Arial/DejaVu support Hebrew)
    const fontName = "Arial";
    const fontSize = 24;
    const fontColor = "white";
    const outlineColor = "black";
    const outlineWidth = 2;

    const filter = `subtitles='${escapedSrt}':force_style='FontName=${fontName},FontSize=${fontSize},PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,Outline=2,BorderStyle=3,Alignment=2,MarginV=50'`;

    try {
        await execAsync(
            `ffmpeg -y -i "${inputVideoPath}" -vf "${filter}" -c:a copy "${outputPath}"`,
            { timeout: 120000 }
        );
    } finally {
        await unlink(srtPath).catch(() => {});
    }
}

/**
 * Check if ffmpeg is available in the environment.
 */
export async function isFfmpegAvailable(): Promise<boolean> {
    try {
        await execAsync("ffmpeg -version", { timeout: 5000 });
        return true;
    } catch {
        return false;
    }
}
