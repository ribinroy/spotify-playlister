import { NextResponse } from "next/server";
import { getSpotifyAuthUrl } from "@/lib/spotify/auth";

export async function GET() {
  const authUrl = getSpotifyAuthUrl();
  return NextResponse.redirect(authUrl);
}
