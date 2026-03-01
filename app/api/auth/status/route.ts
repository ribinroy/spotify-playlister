import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get("spotify_access_token")?.value;
  const refreshToken = request.cookies.get("spotify_refresh_token")?.value;

  if (accessToken) {
    return NextResponse.json({ authenticated: true });
  }

  if (refreshToken) {
    // Token expired but refresh token exists — frontend should trigger refresh
    return NextResponse.json({ authenticated: false, canRefresh: true });
  }

  return NextResponse.json({ authenticated: false, canRefresh: false });
}
