import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode } from '@/lib/spotify';

const COOKIE_OPTS = {
  httpOnly: true,
  secure  : process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path    : '/',
};

export async function GET(req: NextRequest) {
  const code  = req.nextUrl.searchParams.get('code');
  const error = req.nextUrl.searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(new URL('/?spotify=denied', req.url));
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/spotify/callback`;

  try {
    const tokens = await exchangeCode(code, redirectUri);
    const res    = NextResponse.redirect(new URL('/?spotify=connected', req.url));

    res.cookies.set('sp_refresh', tokens.refresh_token, {
      ...COOKIE_OPTS,
      maxAge: 60 * 60 * 24 * 365,
    });
    res.cookies.set('sp_access', tokens.access_token, {
      ...COOKIE_OPTS,
      maxAge: tokens.expires_in - 60,
    });
    return res;
  } catch (err) {
    console.error('[spotify/callback] token exchange failed:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(new URL(`/?spotify=error&reason=${encodeURIComponent(msg)}`, req.url));
  }
}
