const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

export async function spotifyFetch(
  endpoint: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

export async function searchTracks(
  query: string,
  accessToken: string,
  limit: number = 5
): Promise<Response> {
  const params = new URLSearchParams({
    q: query,
    type: "track",
    limit: String(limit),
  });
  return spotifyFetch(`/search?${params}`, accessToken);
}

export async function getCurrentUser(
  accessToken: string
): Promise<Response> {
  return spotifyFetch("/me", accessToken);
}

export async function createPlaylist(
  userId: string,
  name: string,
  accessToken: string,
  isPublic: boolean = false
): Promise<Response> {
  return spotifyFetch(`/users/${userId}/playlists`, accessToken, {
    method: "POST",
    body: JSON.stringify({
      name,
      public: isPublic,
      description: "Created by Spotifolder",
    }),
  });
}

export async function addTracksToPlaylist(
  playlistId: string,
  uris: string[],
  accessToken: string
): Promise<Response> {
  return spotifyFetch(`/playlists/${playlistId}/tracks`, accessToken, {
    method: "POST",
    body: JSON.stringify({ uris }),
  });
}
