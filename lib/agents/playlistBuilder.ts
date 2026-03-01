import { createPlaylist, addTracksToPlaylist, getCurrentUser } from "@/lib/spotify/client";
import { throttledRequest } from "./throttle";
import type { MatchResult, CreatedPlaylist } from "@/types";

const BATCH_SIZE = 100;

export async function buildPlaylists(
  matches: MatchResult[],
  accessToken: string,
  onProgress?: (status: string, current: number, total: number) => void
): Promise<CreatedPlaylist[]> {
  // Get user ID
  const userResponse = await throttledRequest<{ id: string }>(() =>
    getCurrentUser(accessToken)
  );
  const userId = userResponse.id;

  // Group approved matches by playlist name
  const groups = new Map<string, string[]>();
  for (const match of matches) {
    if (!match.spotifyTrack) continue;
    const name = match.trackEntry.playlistName;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name)!.push(match.spotifyTrack.uri);
  }

  const playlistNames = Array.from(groups.keys());
  const results: CreatedPlaylist[] = [];

  for (let i = 0; i < playlistNames.length; i++) {
    const name = playlistNames[i];
    const uris = groups.get(name)!;

    onProgress?.(`Creating "${name}"`, i + 1, playlistNames.length);

    // Create the playlist
    const playlist = await throttledRequest<{
      id: string;
      snapshot_id: string;
    }>(() => createPlaylist(userId, name, accessToken));

    // Add tracks in batches of 100
    let snapshotId = playlist.snapshot_id;
    for (let j = 0; j < uris.length; j += BATCH_SIZE) {
      const batch = uris.slice(j, j + BATCH_SIZE);
      const addResult = await throttledRequest<{ snapshot_id: string }>(() =>
        addTracksToPlaylist(playlist.id, batch, accessToken)
      );
      snapshotId = addResult.snapshot_id;
    }

    results.push({
      playlistName: name,
      spotifyPlaylistId: playlist.id,
      trackCount: uris.length,
      snapshotId,
    });
  }

  return results;
}
