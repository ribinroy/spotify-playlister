# Technical Specification — Spotifolder

---

## 1. Tech Stack

| Layer              | Technology                        | Purpose                                                       |
| :----------------- | :-------------------------------- | :------------------------------------------------------------ |
| Framework          | Next.js 15+ (App Router)         | Client-side file picking + server-side API proxy for secrets  |
| Local File Access  | File System Access API            | `window.showDirectoryPicker()` — recursive folder reads       |
| Metadata Parser    | `music-metadata-browser`          | Extract ID3 tags from file blobs in the browser               |
| State Management   | TanStack Query (React Query)      | Track match status, loading/error states for hundreds of rows |
| Throttling         | `p-limit`                         | Concurrency-limited request queue                             |
| String Matching    | Custom Levenshtein implementation | Confidence scoring for track matches                          |
| Styling            | Tailwind CSS                      | Utility-first styling                                         |
| Auth               | Spotify OAuth 2.0 (Auth Code)    | Server-side token exchange via Next.js API routes             |

---

## 2. Project Structure

```
spotify-playlister/
├── app/
│   ├── layout.tsx                  # Root layout, providers
│   ├── page.tsx                    # Main app page (single-page flow)
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts      # Initiates OAuth redirect
│       │   ├── callback/route.ts   # Exchanges code for tokens
│       │   └── refresh/route.ts    # Refreshes expired tokens
│       └── spotify/
│           └── proxy/route.ts      # Proxies Spotify API calls (hides secret)
├── components/
│   ├── FolderPicker.tsx            # "Select Folder" button + file summary
│   ├── MappingTable.tsx            # Spreadsheet-like match review table
│   ├── TrackRow.tsx                # Single row in the mapping table
│   ├── SearchModal.tsx             # Manual Spotify search popup
│   ├── ProgressBar.tsx             # Scan/match/create progress indicator
│   └── AuthButton.tsx              # Login/logout with Spotify
├── lib/
│   ├── agents/
│   │   ├── folderScanner.ts        # Recursive directory traversal
│   │   ├── metadataExtractor.ts    # ID3 tag parsing
│   │   ├── spotifySearch.ts        # Search + confidence scoring
│   │   ├── throttle.ts             # Rate-limited request queue
│   │   └── playlistBuilder.ts      # Playlist creation + batch track adds
│   ├── spotify/
│   │   ├── client.ts               # Spotify API wrapper
│   │   └── auth.ts                 # Token management helpers
│   ├── matching/
│   │   └── levenshtein.ts          # String similarity algorithm
│   └── cache.ts                    # localStorage-based match cache
├── types/
│   └── index.ts                    # Shared TypeScript interfaces
├── PRD.md
├── agents.md
├── TECH_SPEC.md
└── package.json
```

---

## 3. Core Data Types

```ts
// Scanned from the local filesystem
interface ScannedFile {
  filename: string;
  path: string;
  playlistName: string;          // Flattened: "Electronic - Techno"
  fileHandle: FileSystemFileHandle;
}

// After metadata extraction
interface TrackEntry {
  id: string;                    // Generated UUID
  filename: string;
  playlistName: string;
  artist: string;
  album: string;
  title: string;
  duration: number;              // Seconds
}

// After Spotify search
interface MatchResult {
  trackEntry: TrackEntry;
  spotifyTrack: SpotifyTrack | null;
  confidence: 'green' | 'yellow' | 'red';
  score: number;                 // 0–100
  manuallySelected: boolean;     // True if user overrode via search modal
}

// Spotify track (subset of API response)
interface SpotifyTrack {
  uri: string;                   // "spotify:track:abc123"
  name: string;
  artists: string[];
  album: string;
  durationMs: number;
}

// Created playlist result
interface CreatedPlaylist {
  playlistName: string;
  spotifyPlaylistId: string;
  trackCount: number;
  snapshotId: string;
}
```

---

## 4. System Flow (Step-by-Step)

### Step A: Recursive Folder Scanning

```ts
async function scanFolder(
  directoryHandle: FileSystemDirectoryHandle,
  parentPath: string = ""
): Promise<ScannedFile[]> {
  const files: ScannedFile[] = [];

  for await (const entry of directoryHandle.values()) {
    const fullPath = parentPath ? `${parentPath} - ${entry.name}` : entry.name;

    if (entry.kind === 'directory') {
      const nested = await scanFolder(entry, fullPath);
      files.push(...nested);
    } else if (/\.(mp3|wav|flac)$/i.test(entry.name)) {
      files.push({
        filename: entry.name,
        path: fullPath,
        playlistName: parentPath || 'Root',
        fileHandle: entry,
      });
    }
  }

  return files;
}
```

### Step B: Traffic Light Matching Algorithm

1. Build search query: `track:{title} artist:{artist}`
2. Call `GET /v1/search?q=...&type=track&limit=5`
3. For each result, compute Levenshtein similarity against local metadata
4. Assign confidence:

| Confidence | Score Range | Behavior                     |
| :--------- | :---------- | :--------------------------- |
| 🟢 Green   | ≥ 90%       | Auto-accept top result       |
| 🟡 Yellow  | 50–89%      | Flag for manual review       |
| 🔴 Red     | < 50%       | Mark unmatched, show "Search"|

### Step C: Flattened Playlist Creation

1. **Group** all approved matches by `playlistName`.
2. **Create** each playlist via `POST /v1/me/playlists`.
3. **Batch add** tracks in chunks of 100 via `POST /v1/playlists/{id}/tracks`.
4. **Store** `snapshot_id` from each batch response to detect conflicts on retry.

---

## 5. Throttling Strategy

```
┌────────────────────────────────────────────┐
│              Request Queue                  │
│                                            │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ │
│  │ Req │ │ Req │ │ Req │ │ Req │ │ Req │ │
│  └──┬──┘ └──┬──┘ └──┬──┘ └─────┘ └─────┘ │
│     │       │       │      waiting...      │
└─────┼───────┼───────┼─────────────────────┘
      │       │       │
      ▼       ▼       ▼    ← p-limit (max 3–5 concurrent)
   Spotify  Spotify  Spotify
     API      API      API
      │       │       │
      ▼       ▼       ▼
   On 429 → Read Retry-After → Pause queue → Resume
```

**Implementation details:**
- `p-limit(5)` wraps all Spotify API calls.
- A global `paused` flag halts new requests when a `429` is received.
- The `Retry-After` header value (seconds) is used as the exact pause duration.
- Queue resumes automatically after the pause.

---

## 6. Caching Strategy

**Storage:** `localStorage` (keyed by `artist|title` normalized lowercase).

**Cache entry:**
```ts
interface CacheEntry {
  spotifyUri: string;
  spotifyName: string;
  spotifyArtist: string;
  confidence: 'green' | 'yellow';
  timestamp: number;
}
```

**Rules:**
- Before every Spotify search, check the cache.
- Only cache green and user-confirmed yellow matches.
- Cache entries expire after 30 days (Spotify catalog changes).
- Duplicate songs across folders reuse the cached URI — zero API calls.

---

## 7. Authentication Flow

```
Browser                    Next.js Server              Spotify
  │                              │                        │
  │──GET /api/auth/login────────►│                        │
  │                              │──302 Redirect─────────►│
  │◄─────────────────────────────┤                        │
  │──User authorizes─────────────────────────────────────►│
  │                              │◄──Callback + code──────│
  │                              │──POST /api/token───────►│
  │                              │◄──access + refresh─────│
  │◄──Set session cookie─────────│                        │
  │                              │                        │
```

- **Client ID:** Exposed in frontend (public).
- **Client Secret:** Never leaves the server; used only in `/api/auth/*` routes.
- **Scopes:** `playlist-modify-public`, `playlist-modify-private`.
- **Token refresh:** Server-side via `/api/auth/refresh` before expiry.

---

## 8. API Endpoints Used

| Method | Endpoint                          | Purpose                      | Rate Concern |
| :----- | :-------------------------------- | :--------------------------- | :----------- |
| GET    | `/v1/search`                      | Find tracks by metadata      | High         |
| GET    | `/v1/me`                          | Get user profile/ID          | Low          |
| POST   | `/v1/me/playlists`                | Create a new playlist        | Medium       |
| POST   | `/v1/playlists/{id}/tracks`       | Add tracks (batch of 100)    | Medium       |

**2026 considerations:**
- Default search limit is 5–10 results — the Search Modal reflects this.
- `snapshot_id` must be tracked per batch add to prevent duplicates on retries.

---

## 9. Browser Compatibility

| Feature                  | Chrome | Edge | Opera | Firefox | Safari |
| :----------------------- | :----: | :--: | :---: | :-----: | :----: |
| File System Access API   |   ✅   |  ✅  |  ✅   |   ❌    |   ❌   |
| `music-metadata-browser` |   ✅   |  ✅  |  ✅   |   ✅    |   ✅   |

A browser compatibility check should display a warning banner for unsupported browsers.

---

## 10. Error Handling

| Scenario                  | Handling                                                        |
| :------------------------ | :-------------------------------------------------------------- |
| 429 Rate Limit            | Pause queue, wait `Retry-After` seconds, auto-resume            |
| OAuth token expired       | Auto-refresh via `/api/auth/refresh`; retry the failed request  |
| No ID3 tags on file       | Fall back to filename parsing (`Artist - Title.mp3`)            |
| Spotify search returns 0  | Mark as 🔴 Red; enable manual search                            |
| Batch add partially fails | Use `snapshot_id` to determine what was added; retry remainder  |
| Browser not supported     | Show warning banner; disable "Select Folder" button             |

---

## 11. Performance Targets

| Metric                    | Target           |
| :------------------------ | :--------------- |
| Folder scan (500 files)   | < 30 seconds     |
| Metadata extraction       | < 60 seconds     |
| Spotify matching          | < 90 seconds     |
| Total flow (500 tracks)   | < 3 minutes      |
| Auto-match accuracy       | > 85%            |
