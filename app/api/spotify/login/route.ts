import { NextResponse } from 'next/server';

const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'playlist-read-private',
  'playlist-read-collaborative',
].join(' ');

export function GET() {
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/spotify/callback`;
  const params = new URLSearchParams({
    client_id    : process.env.SPOTIFY_CLIENT_ID!,
    response_type: 'code',
    redirect_uri : redirectUri,
    scope        : SCOPES,
  });
  return NextResponse.redirect(
    `https://accounts.spotify.com/authorize?${params}`,
  );
}
