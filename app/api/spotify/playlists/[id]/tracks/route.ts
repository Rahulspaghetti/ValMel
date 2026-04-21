import { NextRequest, NextResponse } from 'next/server';
import { refreshAccessToken } from '@/lib/spotify';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

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
    const res = await fetch(
      `https://api.spotify.com/v1/playlists/${id}/tracks?limit=50`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      return NextResponse.json({ error: 'spotify_error' }, { status: res.status });
    }
    const data = await res.json();
    const tracks = (data.items ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((i: any) => i.track?.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((i: any) => ({
        id     : i.track.id,
        uri    : i.track.uri,
        name   : i.track.name,
        artists: (i.track.artists ?? []).map((a: { name: string }) => a.name).join(', '),
        art    : i.track.album?.images?.[0]?.url ?? null,
      }));
    return NextResponse.json({ tracks });
  } catch {
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });
  }
}
