# PRD: Spotifolder (Local-to-Spotify Mapper)

## 1. Objective

To create a web-based utility that mirrors a local music directory structure into Spotify playlists, using metadata-based matching and a manual reconciliation UI.

## 2. Target Features

- **Local Directory Access:** Use the File System Access API to read local metadata without uploading files.
- **Flattened Playlist Creation:** Convert nested folders into specific playlist names (e.g., `Folder/Subfolder` becomes `Folder - Subfolder`).
- **Visual Match-Maker:** A "Traffic Light" system for song matching (Green = High Confidence, Yellow = Manual Review Needed).
- **Manual Search Override:** A popup to manually search the Spotify catalog if the auto-match fails.

## 3. Technical Architecture & System Flow

### A. The "Smart" Throttling Strategy

To avoid being banned by the Spotify API, the backend/client service will implement:

- **Request Pooling:** Maximum of 5 concurrent search requests.
- **Rate Limit Handler:** A middleware that catches 429 errors and pauses the queue.
- **Local Cache:** If you've already matched "Bohemian Rhapsody" in one folder, the app remembers the Spotify URI for the next folder to save an API call.

## 4. User Interface (UI) Requirements

### View 1: Folder Selection

- A "Select Folder" button (triggering `window.showDirectoryPicker()`).
- A summary of detected `.mp3`, `.wav`, and `.flac` files.

### View 2: The Mapping Table

A spreadsheet-like view with the following columns:

| Local File (Metadata)       | Spotify Match                | Status    | Action           |
| :-------------------------- | :--------------------------- | :-------- | :--------------- |
| Artist - Title (from ID3)   | Spotify Track Name (Artist)  | 🟢/🟡/🔴 | [Edit / Search]  |

### View 3: Search Popup

- A modal that opens when "Edit" is clicked.
- Search bar pre-filled with the local metadata.
- List of top 5 Spotify results with "Select" buttons.

## 5. Functional Requirements (User Stories)

| ID  | Requirement                                                              | Priority |
| :-- | :----------------------------------------------------------------------- | :------- |
| FR1 | Read ID3 tags (Artist, Album, Title) from local files.                   | P0       |
| FR2 | Create a Spotify playlist for every unique subfolder found.              | P0       |
| FR3 | Use "Flattened Naming" for nested folders (e.g., `Electronic/Techno`).   | P1       |
| FR4 | Implement a Levenshtein distance check to auto-verify matches.           | P1       |
| FR5 | Batch playlist additions (100 tracks per request) to optimize API usage. | P0       |

## 6. Technical Constraints & Security

- **OAuth Scopes:** Needs `playlist-modify-public` and `playlist-modify-private`.
- **No File Upload:** The app must only read metadata; the actual audio bits never leave the user's computer.
- **Browser Compatibility:** Must use Chrome, Edge, or Opera (File System Access API is not yet fully supported in Firefox/Safari).

## 7. Success Metrics

- **Match Accuracy:** >85% of local tracks found automatically.
- **Performance:** A folder of 500 tracks should be fully mapped/reviewed in under 3 minutes.
