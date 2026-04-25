const TOKEN_URL = 'https://accounts.spotify.com/api/token';

export interface SpotifyTokens {
  access_token : string;
  refresh_token: string;
  expires_in   : number;
  token_type   : string;
}

function basicAuth(): string {
  const id     = process.env.SPOTIFY_CLIENT_ID!;
  const secret = process.env.SPOTIFY_CLIENT_SECRET!;
  return `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`;
}

export async function exchangeCode(
  code       : string,
  redirectUri: string,
): Promise<SpotifyTokens> {
  const res = await fetch(TOKEN_URL, {
    method : 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization : basicAuth(),
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Spotify token exchange ${res.status}: ${body}`);
  }
  return res.json();
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<SpotifyTokens> {
  const res = await fetch(TOKEN_URL, {
    method : 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization : basicAuth(),
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  if (!res.ok) throw new Error(`Spotify token refresh ${res.status}`);
  return res.json();
}
