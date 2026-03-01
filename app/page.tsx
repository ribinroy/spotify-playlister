"use client";

import { useState, useCallback, useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";
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
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<AppStep>("auth");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [accessToken, setAccessToken] = useState("");

  const [, setScannedFiles] = useState<ScannedFile[]>([]);
  const [, setTracks] = useState<TrackEntry[]>([]);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [createdPlaylists, setCreatedPlaylists] = useState<CreatedPlaylist[]>([]);

  const [progress, setProgress] = useState({ label: "", current: 0, total: 0 });
  const [editingMatch, setEditingMatch] = useState<MatchResult | null>(null);

  // Check auth on mount + URL error params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error === "token_exchange_failed") {
      toast.error( "Spotify login failed — could not exchange token. Please try again.");
      window.history.replaceState({}, "", "/");
    } else if (error === "auth_failed") {
      toast.error( "Spotify authorization was denied or failed.");
      window.history.replaceState({}, "", "/");
    }

    fetch("/api/auth/status")
      .then((res) => res.json())
      .then(async (data) => {
        if (data.authenticated) {
          setIsLoggedIn(true);
          setStep("select");
          setAccessToken("cookie-based");
        } else if (data.canRefresh) {
          const res = await fetch("/api/auth/refresh", { method: "POST" });
          if (res.ok) {
            setIsLoggedIn(true);
            setStep("select");
            setAccessToken("cookie-based");
          } else {
            toast.error( "Session expired. Please log in again.");
          }
        }
      })
      .catch(() => {
        toast.error( "Could not check authentication status.");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleFilesScanned = useCallback(async (files: ScannedFile[]) => {
    setScannedFiles(files);

    try {
      setStep("extracting");
      const entries = await extractAllMetadata(files, (current, total) => {
        setProgress({ label: "Extracting metadata", current, total });
      });
      setTracks(entries);

      if (entries.length === 0) {
        toast( "No audio files with metadata found in this folder.");
        setStep("select");
        return;
      }

      setStep("matching");
      const results = await searchAllTracks(entries, accessToken, (current, total) => {
        setProgress({ label: "Matching tracks", current, total });
      });
      setMatches(results);
      setStep("review");
    } catch (err) {
      console.error("Scan/match error:", err);
      toast.error( `Failed during processing: ${err instanceof Error ? err.message : "Unknown error"}`);
      setStep("select");
    }
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

    if (approved.length === 0) {
      toast( "No matched tracks to create playlists from.");
      return;
    }

    try {
      setStep("creating");
      const playlists = await buildPlaylists(approved, accessToken, (status, current, total) => {
        setProgress({ label: status, current, total });
      });
      setCreatedPlaylists(playlists);
      setStep("done");
      toast.success( `Created ${playlists.length} playlists on Spotify!`);
    } catch (err) {
      console.error("Playlist creation error:", err);
      toast.error( `Failed to create playlists: ${err instanceof Error ? err.message : "Unknown error"}`);
      setStep("review");
    }
  }, [matches, accessToken]);

  if (loading) {
    return (
      <>
        <Toaster position="top-right" toastOptions={{ style: { background: "#18181b", color: "#fff", border: "1px solid #27272a" } }} />
        <main className="flex items-center justify-center min-h-screen">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-zinc-700 border-t-green-500 rounded-full animate-spin" />
            <p className="text-zinc-400 text-sm">Loading Spotifolder...</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-12">
      <Toaster position="top-right" toastOptions={{ style: { background: "#18181b", color: "#fff", border: "1px solid #27272a" } }} />
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
        <div className="py-12 space-y-16">
          {/* Hero / What is this */}
          <section className="text-center space-y-4">
            <h2 className="text-2xl font-semibold">Your local music, now on Spotify</h2>
            <p className="text-zinc-400 max-w-2xl mx-auto leading-relaxed">
              Spotifolder reads the folder structure and metadata (ID3 tags) from your local
              music library, matches each track against the Spotify catalog, and creates
              playlists that mirror your folder layout — all without uploading a single file.
            </p>
            <div className="pt-4">
              <AuthButton isLoggedIn={false} />
            </div>
          </section>

          {/* How it works */}
          <section className="space-y-6">
            <h3 className="text-lg font-semibold text-center">How it works</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
              <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                <div className="text-2xl">1</div>
                <h4 className="font-medium">Select a folder</h4>
                <p className="text-sm text-zinc-400">
                  Pick a music folder from your computer. The app scans for
                  .mp3, .wav, and .flac files and reads their metadata locally — nothing gets uploaded.
                </p>
              </div>
              <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                <div className="text-2xl">2</div>
                <h4 className="font-medium">Review matches</h4>
                <p className="text-sm text-zinc-400">
                  Each track is searched on Spotify and scored with a traffic-light system:
                  green for confident matches, yellow for review, red for no match. You can
                  manually search and override any result.
                </p>
              </div>
              <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                <div className="text-2xl">3</div>
                <h4 className="font-medium">Create playlists</h4>
                <p className="text-sm text-zinc-400">
                  Hit &quot;Create Library&quot; and Spotifolder builds one Spotify playlist per
                  folder, using a flattened naming scheme
                  (e.g. <span className="text-zinc-300">Electronic - Techno</span>).
                </p>
              </div>
            </div>
          </section>

          {/* Requirements note */}
          <section className="text-center">
            <p className="text-xs text-zinc-600">
              Requires Chrome, Edge, or Opera (File System Access API).
              Your files never leave your computer — only metadata is read.
            </p>
          </section>
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

      <footer className="mt-20 py-6 border-t border-zinc-800 text-center text-sm text-zinc-500">
        Built by{" "}
        <a
          href="https://ribinroy.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-300 hover:text-white transition"
        >
          Ribin Roy
        </a>
      </footer>
    </main>
  );
}
