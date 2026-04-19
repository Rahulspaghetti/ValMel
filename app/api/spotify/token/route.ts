import { NextRequest, NextResponse } from 'next/server';
import { refreshAccessToken } from '@/lib/spotify';

export async function GET(req: NextRequest) {
  const existing = req.cookies.get('sp_access')?.value;
  if (existing) return NextResponse.json({ access_token: existing });

  const refreshToken = req.cookies.get('sp_refresh')?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  try {
    const tokens = await refreshAccessToken(refreshToken);
    const res    = NextResponse.json({ access_token: tokens.access_token });
    res.cookies.set('sp_access', tokens.access_token, {
      httpOnly: true,
      secure  : process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path    : '/',
      maxAge  : tokens.expires_in - 60,
    });
    return res;
  } catch {
    return NextResponse.json({ error: 'refresh_failed' }, { status: 500 });
  }
}
