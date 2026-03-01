import { parseBlob } from "music-metadata";
import { v4 as uuidv4 } from "uuid";
import type { ScannedFile, TrackEntry } from "@/types";

/**
 * Fallback: parse "Artist - Title.mp3" from filename.
 */
function parseFilename(filename: string): { artist: string; title: string } {
  const name = filename.replace(/\.(mp3|wav|flac)$/i, "");
  const parts = name.split(" - ");
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(" - ").trim() };
  }
  return { artist: "", title: name.trim() };
}

export async function extractMetadata(
  scannedFile: ScannedFile
): Promise<TrackEntry> {
  const file = await scannedFile.fileHandle.getFile();

  try {
    const metadata = await parseBlob(file);
    const common = metadata.common;

    const artist = common.artist || "";
    const title = common.title || "";
    const album = common.album || "";
    const duration = metadata.format.duration || 0;

    // Fall back to filename parsing if tags are empty
    if (!artist && !title) {
      const parsed = parseFilename(scannedFile.filename);
      return {
        id: uuidv4(),
        filename: scannedFile.filename,
        playlistName: scannedFile.playlistName,
        artist: parsed.artist,
        album,
        title: parsed.title,
        duration,
      };
    }

    return {
      id: uuidv4(),
      filename: scannedFile.filename,
      playlistName: scannedFile.playlistName,
      artist,
      album,
      title,
      duration,
    };
  } catch {
    // If metadata parsing fails entirely, use filename
    const parsed = parseFilename(scannedFile.filename);
    return {
      id: uuidv4(),
      filename: scannedFile.filename,
      playlistName: scannedFile.playlistName,
      artist: parsed.artist,
      album: "",
      title: parsed.title,
      duration: 0,
    };
  }
}

export async function extractAllMetadata(
  files: ScannedFile[],
  onProgress?: (completed: number, total: number) => void
): Promise<TrackEntry[]> {
  const results: TrackEntry[] = [];
  for (let i = 0; i < files.length; i++) {
    const entry = await extractMetadata(files[i]);
    results.push(entry);
    onProgress?.(i + 1, files.length);
  }
  return results;
}
