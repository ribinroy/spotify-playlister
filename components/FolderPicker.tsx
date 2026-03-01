"use client";

import { useState } from "react";
import type { ScannedFile } from "@/types";
import { scanFolder } from "@/lib/agents/folderScanner";

interface FolderPickerProps {
  onFilesScanned: (files: ScannedFile[]) => void;
  disabled?: boolean;
}

export default function FolderPicker({
  onFilesScanned,
  disabled,
}: FolderPickerProps) {
  const [scanning, setScanning] = useState(false);
  const [fileCount, setFileCount] = useState(0);

  const handleSelectFolder = async () => {
    try {
      const directoryHandle = await window.showDirectoryPicker();
      setScanning(true);
      setFileCount(0);

      const files = await scanFolder(directoryHandle, "", (count) => {
        setFileCount(count);
      });

      onFilesScanned(files);
    } catch (err) {
      // User cancelled the picker
      if ((err as Error).name !== "AbortError") {
        console.error("Folder scan error:", err);
      }
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-8 border-2 border-dashed border-zinc-700 rounded-xl">
      <button
        onClick={handleSelectFolder}
        disabled={disabled || scanning}
        className="px-6 py-3 rounded-full bg-white text-black font-semibold hover:bg-zinc-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {scanning ? "Scanning..." : "Select Folder"}
      </button>

      {scanning && (
        <p className="text-sm text-zinc-400">
          Found {fileCount} audio files...
        </p>
      )}

      {!scanning && fileCount > 0 && (
        <p className="text-sm text-zinc-400">
          {fileCount} audio files detected (.mp3, .wav, .flac)
        </p>
      )}
    </div>
  );
}
