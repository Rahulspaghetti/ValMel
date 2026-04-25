import { NextRequest, NextResponse } from 'next/server';
import { refreshAccessToken } from '@/lib/spotify';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTracks(items: any[]) {
  return items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((i: any) => i?.item?.id && i.item.type === 'track' && !i.is_local)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((i: any) => ({
      id     : i.item.id,
      uri    : i.item.uri,
      name   : i.item.name,
      artists: (i.item.artists ?? []).map((a: { name: string }) => a.name).join(', '),
      art    : i.item.album?.images?.[0]?.url ?? null,
    }));
}

async function fetchAllTracks(id: string, token: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allItems: any[] = [];
  let url: string | null = `https://api.spotify.com/v1/playlists/${id}/items?limit=100`;

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache  : 'no-store',
    });
    if (!res.ok) throw res.status;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    allItems.push(...(data.items ?? []));
    url = data.next ?? null;
  }
  return allItems;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id }   = await params;
  const refresh  = req.cookies.get('sp_refresh')?.value;
  let token      = req.cookies.get('sp_access')?.value;
  let newToken: string | null = null;
  if (!token) {
    if (!refresh) return NextResponse.json({ error: 'not_connected' }, { status: 401 });  
    try {
      const t = await refreshAccessToken(refresh);
      token   = t.access_token;
      newToken = token;
    } catch {
      return NextResponse.json({ error: 'refresh_failed' }, { status: 401 });
    }
  }

  try {
    let items = await fetchAllTracks(id, token!);
    if (!items && refresh) {
      const t  = await refreshAccessToken(refresh);
      token    = t.access_token;
      newToken = token;
      items    = await fetchAllTracks(id, token);
    }
    const out = NextResponse.json({ tracks: mapTracks(items) });
    
    if (newToken) {
      out.cookies.set('sp_access', newToken, {
        httpOnly: true,
        secure  : process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path    : '/',
        maxAge  : 3540,
      });
    }

    return out;
  } catch (status) {
    if (status === 401 && refresh) {
      try {
        const t  = await refreshAccessToken(refresh);
        newToken = t.access_token;
        const items = await fetchAllTracks(id, newToken);
        const out   = NextResponse.json({ tracks: mapTracks(items) });
        out.cookies.set('sp_access', newToken, {
          httpOnly: true,
          secure  : process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path    : '/',
          maxAge  : 3540,
        });
        return out;
      } catch {
        return NextResponse.json({ error: 'refresh_failed' }, { status: 401 });
      }
    }
    return NextResponse.json({ error: `spotify_${status}` }, { status: typeof status === 'number' ? status : 500 });
  }
}
