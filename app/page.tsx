"use client";

import { useState, useCallback, useEffect } from "react";
import AuthButton from "@/components/AuthButton";
import FolderPicker from "@/components/FolderPicker";
import MappingTable from "@/components/MappingTable";
import SearchModal from "@/components/SearchModal";
import ProgressBar from "@/components/ProgressBar";
import { extractAllMetadata } from "@/lib/agents/metadataExtractor";
import { searchAllTracks } from "@/lib/agents/spotifySearch";
import { buildPlaylists } from "@/lib/agents/playlistBuilder";
import type { ScannedFile, TrackEntry, MatchResult, SpotifyTrack, CreatedPlaylist } from "@/types";

type AppStep = "auth" | "select" | "extracting" | "matching" | "review" | "creating" | "done";

export default function Home() {
  const [step, setStep] = useState<AppStep>("auth");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [accessToken, setAccessToken] = useState("");

  const [, setScannedFiles] = useState<ScannedFile[]>([]);
  const [, setTracks] = useState<TrackEntry[]>([]);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [createdPlaylists, setCreatedPlaylists] = useState<CreatedPlaylist[]>([]);

  const [progress, setProgress] = useState({ label: "", current: 0, total: 0 });
  const [editingMatch, setEditingMatch] = useState<MatchResult | null>(null);

  // Check auth on mount
  useEffect(() => {
    fetch("/api/spotify/proxy?endpoint=/me")
      .then((res) => {
        if (res.ok) {
          setIsLoggedIn(true);
          setStep("select");
          setAccessToken("cookie-based");
        }
      })
      .catch(() => {});
  }, []);

  const handleFilesScanned = useCallback(async (files: ScannedFile[]) => {
    setScannedFiles(files);
    setStep("extracting");

    const entries = await extractAllMetadata(files, (current, total) => {
      setProgress({ label: "Extracting metadata", current, total });
    });
    setTracks(entries);
    setStep("matching");

    const results = await searchAllTracks(entries, accessToken, (current, total) => {
      setProgress({ label: "Matching tracks", current, total });
    });
    setMatches(results);
    setStep("review");
  }, [accessToken]);

  const handleEditSelect = useCallback(
    (match: MatchResult, track: SpotifyTrack) => {
      setMatches((prev) =>
        prev.map((m) =>
          m.trackEntry.id === match.trackEntry.id
            ? { ...m, spotifyTrack: track, confidence: "green", score: 100, manuallySelected: true }
            : m
        )
      );
      setEditingMatch(null);
    },
    []
  );

  const handleCreateLibrary = useCallback(async () => {
    const approved = matches.filter(
      (m) => m.confidence === "green" || (m.confidence === "yellow" && m.spotifyTrack)
    );

    setStep("creating");
    const playlists = await buildPlaylists(approved, accessToken, (status, current, total) => {
      setProgress({ label: status, current, total });
    });
    setCreatedPlaylists(playlists);
    setStep("done");
  }, [matches, accessToken]);

  return (
    <main className="max-w-5xl mx-auto px-4 py-12">
      <header className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-3xl font-bold">Spotifolder</h1>
          <p className="text-zinc-400 mt-1">
            Map your local music folders to Spotify playlists
          </p>
        </div>
        <AuthButton isLoggedIn={isLoggedIn} />
      </header>

      {/* Step: Not logged in */}
      {step === "auth" && (
        <div className="text-center py-20">
          <p className="text-zinc-400 mb-6">
            Connect your Spotify account to get started.
          </p>
          <AuthButton isLoggedIn={false} />
        </div>
      )}

      {/* Step: Select folder */}
      {step === "select" && (
        <FolderPicker onFilesScanned={handleFilesScanned} />
      )}

      {/* Step: Extracting / Matching */}
      {(step === "extracting" || step === "matching") && (
        <div className="py-12">
          <ProgressBar
            label={progress.label}
            current={progress.current}
            total={progress.total}
          />
        </div>
      )}

      {/* Step: Review matches */}
      {step === "review" && (
        <div className="space-y-6">
          <MappingTable
            matches={matches}
            onEdit={(match) => setEditingMatch(match)}
          />

          <div className="flex justify-between items-center">
            <button
              onClick={() => {
                setStep("select");
                setMatches([]);
                setTracks([]);
                setScannedFiles([]);
              }}
              className="px-4 py-2 rounded-full bg-zinc-800 text-white text-sm hover:bg-zinc-700 transition"
            >
              Start Over
            </button>
            <button
              onClick={handleCreateLibrary}
              className="px-6 py-3 rounded-full bg-green-500 text-black font-semibold hover:bg-green-400 transition"
            >
              Create Library ({matches.filter((m) => m.confidence !== "red" || m.manuallySelected).length} tracks)
            </button>
          </div>
        </div>
      )}

      {/* Step: Creating playlists */}
      {step === "creating" && (
        <div className="py-12">
          <ProgressBar
            label={progress.label}
            current={progress.current}
            total={progress.total}
          />
        </div>
      )}

      {/* Step: Done */}
      {step === "done" && (
        <div className="text-center py-12 space-y-6">
          <h2 className="text-2xl font-bold">Library Created!</h2>
          <p className="text-zinc-400">
            {createdPlaylists.length} playlists created with{" "}
            {createdPlaylists.reduce((sum, p) => sum + p.trackCount, 0)} tracks
          </p>
          <div className="space-y-2 max-w-md mx-auto">
            {createdPlaylists.map((p) => (
              <div
                key={p.spotifyPlaylistId}
                className="flex justify-between items-center p-3 rounded-lg bg-zinc-900"
              >
                <span className="text-sm font-medium">{p.playlistName}</span>
                <span className="text-xs text-zinc-400">{p.trackCount} tracks</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              setStep("select");
              setMatches([]);
              setTracks([]);
              setScannedFiles([]);
              setCreatedPlaylists([]);
            }}
            className="px-6 py-3 rounded-full bg-white text-black font-semibold hover:bg-zinc-200 transition"
          >
            Map Another Folder
          </button>
        </div>
      )}

      {/* Search Modal */}
      {editingMatch && (
        <SearchModal
          match={editingMatch}
          accessToken={accessToken}
          onSelect={handleEditSelect}
          onClose={() => setEditingMatch(null)}
        />
      )}
    </main>
  );
}
