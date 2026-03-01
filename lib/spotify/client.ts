/**
 * All Spotify API calls route through /api/spotify/proxy.
 * The proxy reads the access token from httpOnly cookies server-side.
 */

export async function spotifyFetch(
  endpoint: string,
  _accessToken: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = options.method || "GET";
  const proxyUrl = `/api/spotify/proxy?endpoint=${encodeURIComponent(endpoint)}`;

  const fetchOptions: RequestInit = { method };

  if (method === "POST" && options.body) {
    fetchOptions.body = options.body;
    fetchOptions.headers = { "Content-Type": "application/json" };
  }

  return fetch(proxyUrl, fetchOptions);
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
