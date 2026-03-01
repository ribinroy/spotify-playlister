"use client";

import { useState } from "react";
import { searchTracks } from "@/lib/spotify/client";
import type { MatchResult, SpotifyTrack } from "@/types";

interface SearchModalProps {
  match: MatchResult;
  accessToken: string;
  onSelect: (match: MatchResult, track: SpotifyTrack) => void;
  onClose: () => void;
}

interface SpotifySearchItem {
  uri: string;
  name: string;
  artists: Array<{ name: string }>;
  album: { name: string };
  duration_ms: number;
}

export default function SearchModal({
  match,
  accessToken,
  onSelect,
  onClose,
}: SearchModalProps) {
  const [query, setQuery] = useState(
    `${match.trackEntry.artist} ${match.trackEntry.title}`.trim()
  );
  const [results, setResults] = useState<SpotifySearchItem[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const response = await searchTracks(query, accessToken, 5);
      const data = await response.json();
      setResults(data.tracks?.items || []);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setSearching(false);
    }
  };

  const handleSelect = (item: SpotifySearchItem) => {
    const track: SpotifyTrack = {
      uri: item.uri,
      name: item.name,
      artists: item.artists.map((a) => a.name),
      album: item.album.name,
      durationMs: item.duration_ms,
    };
    onSelect(match, track);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-lg mx-4 p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold">Search Spotify</h3>
            <p className="text-sm text-zinc-400 mt-1">
              {match.trackEntry.filename}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1 px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-green-500"
            placeholder="Search artist, track name..."
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="px-4 py-2 rounded-lg bg-green-500 text-black text-sm font-medium hover:bg-green-400 transition disabled:opacity-50"
          >
            {searching ? "..." : "Search"}
          </button>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {results.length === 0 && !searching && (
            <p className="text-sm text-zinc-500 text-center py-4">
              Press Search to find tracks
            </p>
          )}
          {results.map((item) => (
            <div
              key={item.uri}
              className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{item.name}</div>
                <div className="text-xs text-zinc-400 truncate">
                  {item.artists.map((a) => a.name).join(", ")} &middot;{" "}
                  {item.album.name}
                </div>
              </div>
              <button
                onClick={() => handleSelect(item)}
                className="ml-3 px-3 py-1 text-xs rounded-full bg-green-500 text-black font-medium hover:bg-green-400 transition shrink-0"
              >
                Select
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
