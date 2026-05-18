import { type NextRequest, NextResponse } from "next/server";
import { readSessionCookie, isSessionExpired } from "@/app/lib/auth/session"; 

// ---------------------------------------------------------------------------
// GET /api/auth/token
//
// Returns the current session's access token to JS so the SignalR hub
// connection can attach it as Authorization: Bearer. Same-origin only the
// HTTP-only session cookie travels with the request, then this route hands
// the token to JS via the response body. JS still can't read the cookie
// itself.
//
// Cache: 'no-store' — never let a CDN or browser stash a JWT.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
    const session = readSessionCookie(request);

    if (!session || isSessionExpired(session)) {
        return NextResponse.json(
            { error: 'unauthenticated' },
            { status: 401, headers: { 'Cache-control': 'no-store' } },
        );
    }

    return NextResponse.json(
        { accessToken: session.accessToken },
        { status: 200, headers: { 'Cache-control': 'no-store' } }
    )
}