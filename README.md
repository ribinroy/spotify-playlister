# Spotifolder

A web-based utility that mirrors your local music directory structure into Spotify playlists. Point it at a folder, and it reads metadata from your files, finds matches on Spotify, and creates playlists that mirror your folder layout — all without ever uploading your audio files.

## Features

- **Local Directory Scanning** — Uses the File System Access API to read `.mp3`, `.wav`, and `.flac` files directly in the browser. No files are uploaded.
- **ID3 Metadata Extraction** — Reads artist, album, title, and duration from ID3/Vorbis tags. Falls back to filename parsing (`Artist - Title.mp3`) when tags are missing.
- **Traffic Light Matching** — Automatically matches local tracks to Spotify using Levenshtein distance scoring:
  - **Green (>=90%)** — Auto-accepted match
  - **Yellow (50-89%)** — Flagged for manual review
  - **Red (<50%)** — Unmatched, manual search required
- **Manual Search Override** — Search the Spotify catalog directly and pick the correct match when auto-matching fails.
- **Flattened Playlist Naming** — Nested folders are converted to playlist names (e.g., `Electronic/Techno` becomes `Electronic - Techno`).
- **Smart Throttling** — Concurrency-limited request queue (`p-limit`) with automatic 429 rate-limit handling and retry.
- **Local Cache** — Previously matched tracks are cached in `localStorage` to avoid redundant API calls across folders.
- **Batch Playlist Creation** — Tracks are added in chunks of 100 per Spotify API best practices.

## Tech Stack

| Layer | Technology | Purpose |
|:------|:-----------|:--------|
| Framework | Next.js 16 (App Router) | Client-side file picking + server-side API proxy |
| UI | React 19 + Tailwind CSS 4 | Component rendering and styling |
| State | TanStack React Query 5 | Async state management for match results |
| Metadata | `music-metadata` | ID3/Vorbis tag parsing from file blobs |
| Throttling | `p-limit` | Concurrency-limited Spotify API request queue |
| Auth | Spotify OAuth 2.0 (Authorization Code) | Server-side token exchange via API routes |

## Browser Compatibility

The File System Access API is required for local folder scanning.

| Feature | Chrome | Edge | Opera | Firefox | Safari |
|:--------|:------:|:----:|:-----:|:-------:|:------:|
| File System Access API | Yes | Yes | Yes | No | No |
| Metadata parsing | Yes | Yes | Yes | Yes | Yes |

## Getting Started

### Prerequisites

- Node.js 18+
- A [Spotify Developer](https://developer.spotify.com/dashboard) application with a Client ID and Client Secret

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/spotify-playlister.git
   cd spotify-playlister
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file from the example:
   ```bash
   cp .env.example .env.local
   ```

4. Fill in your Spotify credentials:
   ```env
   SPOTIFY_CLIENT_ID=your_client_id_here
   SPOTIFY_CLIENT_SECRET=your_client_secret_here
   SPOTIFY_REDIRECT_URI=http://localhost:3000/api/auth/callback
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

5. In your Spotify Developer Dashboard, add `http://localhost:3000/api/auth/callback` as a Redirect URI.

6. Start the development server:
   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000) in Chrome, Edge, or Opera.

## Project Structure

```
spotify-playlister/
├── app/
│   ├── layout.tsx                  # Root layout, providers
│   ├── page.tsx                    # Main app page (single-page flow)
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts      # Initiates OAuth redirect
│       │   ├── callback/route.ts   # Exchanges code for tokens
│       │   └── logout/route.ts     # Clears session tokens
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
└── types/
    └── index.ts                    # Shared TypeScript interfaces
```

## How It Works

```
Select Folder
     │
     ▼
Folder Scanner ──→ Scans directories, finds audio files
     │
     ▼
Metadata Extractor ──→ Reads ID3 tags from each file
     │
     ▼
Spotify Search ──→ Matches tracks via Spotify API (throttled)
     │
     ▼
Mapping Table ──→ User reviews green/yellow/red matches
     │
     ▼
Playlist Builder ──→ Creates playlists and adds tracks in batches
```

1. **Scan** — User selects a local folder. The app recursively walks it, collecting all supported audio files.
2. **Extract** — ID3 metadata (artist, title, album, duration) is parsed from each file in the browser.
3. **Match** — Each track is searched on Spotify. Results are scored using Levenshtein distance and assigned a confidence level.
4. **Review** — The mapping table shows all matches with a traffic-light status. Users can manually search and override any match.
5. **Create** — Approved matches are grouped by folder, playlists are created on Spotify, and tracks are added in batches of 100.

## Spotify API Scopes

The app requests the following OAuth scopes:

- `playlist-modify-public` — Create and add tracks to public playlists
- `playlist-modify-private` — Create and add tracks to private playlists
- `user-read-private` — Read user profile info
- `user-read-email` — Read user email for display

## Scripts

| Command | Description |
|:--------|:------------|
| `npm run dev` | Start development server |
| `npm run build` | Create production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## Security

- Audio files never leave the user's machine — only metadata is read in the browser.
- The Spotify Client Secret is stored server-side and never exposed to the client.
- All Spotify API calls are proxied through Next.js API routes.

## Author

Ribin Roy
