import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get("spotify_access_token")?.value;
  const refreshToken = request.cookies.get("spotify_refresh_token")?.value;

  if (accessToken) {
    // Try to fetch user profile for display name
    try {
      const res = await fetch("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const user = await res.json();
        return NextResponse.json({
          authenticated: true,
          user: { name: user.display_name, email: user.email, image: user.images?.[0]?.url },
        });
      }
    } catch {
      // Profile fetch failed, still authenticated
    }
    return NextResponse.json({ authenticated: true });
  }

  if (refreshToken) {
    return NextResponse.json({ authenticated: false, canRefresh: true });
  }

  return NextResponse.json({ authenticated: false, canRefresh: false });
}
