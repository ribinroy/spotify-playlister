export interface ScannedFile {
  filename: string;
  path: string;
  playlistName: string;
  fileHandle: FileSystemFileHandle;
}

export interface TrackEntry {
  id: string;
  filename: string;
  playlistName: string;
  artist: string;
  album: string;
  title: string;
  duration: number;
}

export interface MatchResult {
  trackEntry: TrackEntry;
  spotifyTrack: SpotifyTrack | null;
  confidence: "green" | "yellow" | "red";
  score: number;
  manuallySelected: boolean;
}

export interface SpotifyTrack {
  uri: string;
  name: string;
  artists: string[];
  album: string;
  durationMs: number;
}

export interface CreatedPlaylist {
  playlistName: string;
  spotifyPlaylistId: string;
  trackCount: number;
  snapshotId: string;
}

export interface CacheEntry {
  spotifyUri: string;
  spotifyName: string;
  spotifyArtist: string;
  confidence: "green" | "yellow";
  timestamp: number;
}

export interface QueueStatus {
  pending: number;
  active: number;
  completed: number;
  paused: boolean;
}
