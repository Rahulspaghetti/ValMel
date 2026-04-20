import { NextRequest, NextResponse } from 'next/server';
import { refreshAccessToken } from '@/lib/spotify';

export async function GET(req: NextRequest) {
  let token = req.cookies.get('sp_access')?.value;

  if (!token) {
    const refreshToken = req.cookies.get('sp_refresh')?.value;
    if (!refreshToken) {
      return NextResponse.json({ error: 'not_connected' }, { status: 401 });
    }
    try {
      const tokens = await refreshAccessToken(refreshToken);
      token = tokens.access_token;
    } catch {
      return NextResponse.json({ error: 'refresh_failed' }, { status: 401 });
    }
  }

  try {
    const res = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'spotify_error' }, { status: res.status });
    }
    const data = await res.json();
    const playlists = (data.items as Array<{
      id    : string;
      uri   : string;
      name  : string;
      images: Array<{ url: string }>;
      tracks: { total: number };
    }>).map(p => ({
      id        : p.id,
      uri       : p.uri,
      name      : p.name,
      imageUrl  : p.images?.[0]?.url ?? null,
      trackCount: p.tracks?.total ?? 0,
    }));
    return NextResponse.json({ playlists });
  } catch {
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });
  }
}
