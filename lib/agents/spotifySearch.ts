import { searchTracks } from "@/lib/spotify/client";
import { similarityScore } from "@/lib/matching/levenshtein";
import { getCachedMatch, setCachedMatch } from "@/lib/cache";
import { throttledRequest } from "./throttle";
import type { TrackEntry, MatchResult, SpotifyTrack } from "@/types";

interface SpotifySearchResponse {
  tracks?: {
    items: Array<{
      uri: string;
      name: string;
      artists: Array<{ name: string }>;
      album: { name: string };
      duration_ms: number;
    }>;
  };
}

function buildQuery(track: TrackEntry): string {
  const parts: string[] = [];
  if (track.title) parts.push(`track:${track.title}`);
  if (track.artist) parts.push(`artist:${track.artist}`);
  return parts.join(" ") || track.filename.replace(/\.(mp3|wav|flac)$/i, "");
}

function determineConfidence(score: number): "green" | "yellow" | "red" {
  if (score >= 90) return "green";
  if (score >= 50) return "yellow";
  return "red";
}

export async function searchForTrack(
  track: TrackEntry,
  accessToken: string
): Promise<MatchResult> {
  // Check cache first
  const cached = getCachedMatch(track.artist, track.title);
  if (cached) {
    return {
      trackEntry: track,
      spotifyTrack: {
        uri: cached.spotifyUri,
        name: cached.spotifyName,
        artists: [cached.spotifyArtist],
        album: "",
        durationMs: 0,
      },
      confidence: cached.confidence,
      score: cached.confidence === "green" ? 95 : 70,
      manuallySelected: false,
    };
  }

  const query = buildQuery(track);

  const data = await throttledRequest<SpotifySearchResponse>(() =>
    searchTracks(query, accessToken)
  );

  if (!data.tracks || data.tracks.items.length === 0) {
    return {
      trackEntry: track,
      spotifyTrack: null,
      confidence: "red",
      score: 0,
      manuallySelected: false,
    };
  }

  // Score each result and pick the best
  let bestScore = 0;
  let bestTrack: SpotifyTrack | null = null;

  for (const item of data.tracks.items) {
    const titleScore = similarityScore(track.title, item.name);
    const artistScore = similarityScore(
      track.artist,
      item.artists.map((a) => a.name).join(", ")
    );
    const combined = Math.round(titleScore * 0.6 + artistScore * 0.4);

    if (combined > bestScore) {
      bestScore = combined;
      bestTrack = {
        uri: item.uri,
        name: item.name,
        artists: item.artists.map((a) => a.name),
        album: item.album.name,
        durationMs: item.duration_ms,
      };
    }
  }

  const confidence = determineConfidence(bestScore);

  // Cache green matches
  if (confidence === "green" && bestTrack) {
    setCachedMatch(track.artist, track.title, {
      spotifyUri: bestTrack.uri,
      spotifyName: bestTrack.name,
      spotifyArtist: bestTrack.artists[0],
      confidence: "green",
    });
  }

  return {
    trackEntry: track,
    spotifyTrack: bestTrack,
    confidence,
    score: bestScore,
    manuallySelected: false,
  };
}

export async function searchAllTracks(
  tracks: TrackEntry[],
  accessToken: string,
  onProgress?: (completed: number, total: number) => void
): Promise<MatchResult[]> {
  const results: MatchResult[] = [];
  const promises = tracks.map(async (track, i) => {
    const result = await searchForTrack(track, accessToken);
    results.push(result);
    onProgress?.(results.length, tracks.length);
    return result;
  });

  await Promise.all(promises);
  return results;
}
