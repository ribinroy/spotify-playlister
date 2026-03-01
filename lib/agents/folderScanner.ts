import type { ScannedFile } from "@/types";

const SUPPORTED_EXTENSIONS = /\.(mp3|wav|flac)$/i;

export async function scanFolder(
  directoryHandle: FileSystemDirectoryHandle,
  parentPath: string = "",
  onProgress?: (count: number) => void
): Promise<ScannedFile[]> {
  const files: ScannedFile[] = [];

  for await (const entry of directoryHandle.values()) {
    const fullPath = parentPath ? `${parentPath} - ${entry.name}` : entry.name;

    if (entry.kind === "directory") {
      const nested = await scanFolder(
        entry as FileSystemDirectoryHandle,
        fullPath,
        onProgress
      );
      files.push(...nested);
    } else if (SUPPORTED_EXTENSIONS.test(entry.name)) {
      files.push({
        filename: entry.name,
        path: fullPath,
        playlistName: parentPath || "Root",
        fileHandle: entry as FileSystemFileHandle,
      });
      onProgress?.(files.length);
    }
  }

  return files;
}
