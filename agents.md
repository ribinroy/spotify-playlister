# Agents — Spotifolder

This document defines the autonomous agents (modules) that power Spotifolder. Each agent has a single responsibility, clear inputs/outputs, and well-defined boundaries.

---

## 1. Folder Scanner Agent

**Responsibility:** Recursively traverse the user-selected directory and build a structured file tree.

**Trigger:** User clicks "Select Folder" → `window.showDirectoryPicker()`

**Inputs:**
- `FileSystemDirectoryHandle` from the browser API

**Outputs:**
- Array of `ScannedFile` objects:
  ```ts
  {
    filename: string;
    path: string;            // relative path within selected folder
    playlistName: string;    // flattened folder path (e.g., "Electronic - Techno")
    fileHandle: FileSystemFileHandle;
  }
  ```

**Behavior:**
- Recursively walks all subdirectories.
- Filters to supported extensions: `.mp3`, `.wav`, `.flac`.
- Converts nested paths to flattened playlist names using ` - ` as separator.
- Emits progress events so the UI can show a scan progress indicator.

---

## 2. Metadata Extractor Agent

**Responsibility:** Read ID3/Vorbis tags from local files in the browser without uploading them.

**Trigger:** Runs immediately after the Folder Scanner completes, for each `ScannedFile`.

**Inputs:**
- `ScannedFile.fileHandle`

**Outputs:**
- Enriched `TrackEntry` objects:
  ```ts
  {
    filename: string;
    playlistName: string;
    artist: string;
    album: string;
    title: string;
    duration: number;        // seconds
  }
  ```

**Behavior:**
- Uses `music-metadata-browser` to parse file blobs.
- Falls back to filename parsing (`Artist - Title.mp3`) if ID3 tags are missing.
- Runs concurrently (batched) to avoid blocking the main thread.

---

## 3. Spotify Search Agent

**Responsibility:** Find Spotify matches for each local track and assign a confidence score.

**Trigger:** After metadata extraction completes for a batch of tracks.

**Inputs:**
- Array of `TrackEntry` objects
- Spotify access token

**Outputs:**
- Array of `MatchResult` objects:
  ```ts
  {
    trackEntry: TrackEntry;
    spotifyTrack: SpotifyTrack | null;
    confidence: 'green' | 'yellow' | 'red';
    score: number;           // 0–100 similarity score
  }
  ```

**Behavior:**
- Queries `GET /v1/search?q=track:{title} artist:{artist}&type=track&limit=5`.
- Computes Levenshtein distance between local metadata and Spotify results.
- Assigns confidence:
  - **Green (≥90%):** Auto-accept the top result.
  - **Yellow (50–89%):** Flag for manual review.
  - **Red (<50% or no results):** Mark as unmatched.
- Checks local cache (`localStorage`) before making API calls — skips search if the same artist+title was already matched.
- Respects the throttling strategy (see Throttle Agent).

---

## 4. Throttle Agent

**Responsibility:** Control the rate of outgoing Spotify API requests to stay within limits.

**Trigger:** Every outgoing Spotify API call is routed through this agent.

**Inputs:**
- Queued API request functions

**Outputs:**
- Resolved API responses (passed back to the calling agent)

**Behavior:**
- Uses `p-limit` to cap concurrency at 3–5 simultaneous requests.
- On `429 Too Many Requests`:
  - Reads the `Retry-After` header.
  - Pauses the entire queue for that duration.
  - Automatically resumes after the wait.
- Exposes queue status (pending, active, paused) for the UI progress bar.

---

## 5. Playlist Builder Agent

**Responsibility:** Create Spotify playlists and populate them with matched tracks.

**Trigger:** User clicks "Create Library" after reviewing matches.

**Inputs:**
- Array of `MatchResult` objects (green + user-approved yellow)
- Spotify access token
- User's Spotify user ID

**Outputs:**
- Array of created playlists with metadata:
  ```ts
  {
    playlistName: string;
    spotifyPlaylistId: string;
    trackCount: number;
    snapshotId: string;
  }
  ```

**Behavior:**
- Groups matched tracks by `playlistName`.
- For each group:
  1. Calls `POST /v1/me/playlists` to create the playlist.
  2. Batches track URIs into chunks of 100.
  3. Calls `POST /v1/playlists/{id}/tracks` for each chunk.
- Tracks `snapshot_id` per batch to prevent duplicates on retry.
- Reports progress per playlist (created, populating, done).

---

## 6. Auth Agent

**Responsibility:** Handle Spotify OAuth 2.0 Authorization Code flow.

**Trigger:** App load / session expiry / user login.

**Inputs:**
- Spotify Client ID (public, in frontend)
- Spotify Client Secret (server-side only, via Next.js API route)

**Outputs:**
- Valid access token + refresh token stored in session

**Behavior:**
- Initiates OAuth via `/api/auth/login` redirect.
- Exchanges auth code for tokens server-side (keeps Client Secret hidden).
- Auto-refreshes tokens before expiry using the refresh token.
- Required scopes: `playlist-modify-public`, `playlist-modify-private`.

---

## Agent Interaction Flow

```
User clicks "Select Folder"
        │
        ▼
┌─────────────────┐
│ Folder Scanner   │──→ List of ScannedFiles
└─────────────────┘
        │
        ▼
┌─────────────────────┐
│ Metadata Extractor   │──→ List of TrackEntries
└─────────────────────┘
        │
        ▼
┌──────────────────┐     ┌──────────────────┐
│ Spotify Search    │◄───►│ Throttle Agent    │──→ Spotify API
└──────────────────┘     └──────────────────┘
        │
        ▼
   UI: Mapping Table (user reviews matches)
        │
        ▼
┌────────────────────┐
│ Playlist Builder    │──→ Created Playlists on Spotify
└────────────────────┘
```

All API-calling agents (Search, Builder, Auth) route requests through the **Throttle Agent**.
