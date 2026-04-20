import { NextRequest, NextResponse } from 'next/server';
import { refreshAccessToken } from '@/lib/spotify';

export async function POST(req: NextRequest) {
  const body = await req.json() as { playlistUri?: string; deviceId?: string };
  const { playlistUri, deviceId } = body;

  if (!playlistUri || !deviceId) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }

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

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Enable shuffle first (ignore errors — may already be on)
  await fetch(
    `https://api.spotify.com/v1/me/player/shuffle?state=true&device_id=${deviceId}`,
    { method: 'PUT', headers },
  ).catch(() => {});

  // Start playback on the SDK device
  const playRes = await fetch(
    `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
    {
      method : 'PUT',
      headers,
      body   : JSON.stringify({ context_uri: playlistUri }),
    },
  );

  if (!playRes.ok && playRes.status !== 204) {
    const err = await playRes.text().catch(() => '');
    return NextResponse.json({ error: 'play_failed', detail: err }, { status: playRes.status });
  }

  return NextResponse.json({ ok: true });
}
