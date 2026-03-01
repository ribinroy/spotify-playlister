import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/spotify/auth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}?error=auth_failed`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    if (tokens.error) {
      console.error("Token exchange error:", tokens.error, tokens.error_description);
      return NextResponse.redirect(`${appUrl}?error=token_exchange_failed`);
    }

    // Store tokens in a cookie (httpOnly for security)
    const response = NextResponse.redirect(appUrl);

    response.cookies.set("spotify_access_token", tokens.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: tokens.expires_in,
      path: "/",
    });

    response.cookies.set("spotify_refresh_token", tokens.refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.redirect(`${appUrl}?error=server_error`);
  }
}
