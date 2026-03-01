import { NextRequest, NextResponse } from "next/server";
import { refreshAccessToken } from "@/lib/spotify/auth";

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

export async function GET(request: NextRequest) {
  return proxyRequest(request);
}

export async function POST(request: NextRequest) {
  return proxyRequest(request);
}

async function spotifyCall(endpoint: string, token: string, method: string, body?: string) {
  const fetchOptions: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
  if (method === "POST" && body) fetchOptions.body = body;
  return fetch(`${SPOTIFY_API_BASE}${endpoint}`, fetchOptions);
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    console.error("Spotify non-JSON response:", response.status, text);
    return null;
  }
}

async function proxyRequest(request: NextRequest) {
  let accessToken: string | null = request.cookies.get("spotify_access_token")?.value ?? null;
  const refreshToken = request.cookies.get("spotify_refresh_token")?.value ?? null;

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const endpoint = request.nextUrl.searchParams.get("endpoint");
  if (!endpoint) {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  }

  try {
    let body: string | undefined;
    if (request.method === "POST") {
      body = await request.text();
    }

    let response = await spotifyCall(endpoint, accessToken, request.method, body);

    // If token expired, try refreshing
    if (response.status === 401 && refreshToken) {
      const tokens = await refreshAccessToken(refreshToken);
      if (tokens.access_token) {
        const newToken: string = tokens.access_token;
        accessToken = newToken;
        response = await spotifyCall(endpoint, newToken, request.method, body);

        // Return data with updated cookies
        const data = await parseResponse(response);
        if (data === null) {
          return NextResponse.json({ error: "Invalid Spotify response" }, { status: response.status });
        }

        const res = NextResponse.json(data, { status: response.status });
        res.cookies.set("spotify_access_token", newToken, {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          maxAge: tokens.expires_in,
          path: "/",
        });
        if (tokens.refresh_token) {
          res.cookies.set("spotify_refresh_token", tokens.refresh_token, {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 30,
            path: "/",
          });
        }
        return res;
      }
    }

    const data = await parseResponse(response);
    if (data === null) {
      return NextResponse.json({ error: "Invalid Spotify response" }, { status: response.status });
    }

    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    console.error("Proxy error:", err);
    return NextResponse.json({ error: "Proxy error" }, { status: 500 });
  }
}
