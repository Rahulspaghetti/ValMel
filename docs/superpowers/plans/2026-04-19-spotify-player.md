# Spotify Web Player Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the local `music.mp3` player with a Spotify Web Playback SDK widget that persists across both the home page and agent page, requiring one-time OAuth login.

**Architecture:** OAuth 2.0 Authorization Code Flow exchanges a one-time code for an access + refresh token; tokens live in httpOnly cookies server-side; the client calls `/api/spotify/token` to retrieve the short-lived access token for the SDK. The `SpotifyWidget` component is mounted in `app/layout.tsx` so playback continues while navigating between pages. Home page removes its `<audio>` widget; agent page gets the overlay for free.

**Tech Stack:** Next.js 15 App Router, TypeScript, Spotify Web Playback SDK (`https://sdk.scdn.co/spotify-player.js`), Spotify Accounts API, httpOnly cookies via `NextResponse.cookies`.

---

## Files

| File | Action | Purpose |
|------|--------|---------|
| `.env.local` | Modify | Add `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `NEXT_PUBLIC_BASE_URL` |
| `lib/spotify.ts` | Create | Token exchange, refresh, shared types |
| `app/api/spotify/login/route.ts` | Create | Redirect browser to Spotify OAuth consent screen |
| `app/api/spotify/callback/route.ts` | Create | Exchange auth code for tokens, set httpOnly cookies |
| `app/api/spotify/token/route.ts` | Create | Return valid access_token to client (refresh if cookie expired) |
| `components/spotify-widget.tsx` | Create | Self-contained player widget (connect → album art → controls) |
| `components/spotify-widget.module.scss` | Create | Widget styles (mirrors existing music card patterns) |
| `app/layout.tsx` | Modify | Mount `SpotifyWidget` so it persists across pages |
| `app/page.tsx` | Modify | Remove `<audio>` element, all music state, and `fixedBtns` music section |
| `app/page.module.scss` | Modify | Remove `.musicCard`, `.musicIcon`, `.musicInfo`, `.musicControls`, `.musicControl`, `.musicCardCollapsed`, `.musicCardArtist`, `.musicCardTitle` |

---

## Task 1 — Spotify Developer App + env vars

**Files:** `.env.local`

- [ ] Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard), create an app named **MeliBoo**.

- [ ] In the app settings → **Redirect URIs**, add:
  ```
  http://localhost:3000/api/spotify/callback
  https://<your-vercel-domain>/api/spotify/callback
  ```
  Save.

- [ ] Copy the **Client ID** and **Client Secret**. Add to `.env.local`:
  ```
  SPOTIFY_CLIENT_ID=your_client_id_here
  SPOTIFY_CLIENT_SECRET=your_client_secret_here
  NEXT_PUBLIC_BASE_URL=http://localhost:3000
  ```
  For production Vercel deployment also set `NEXT_PUBLIC_BASE_URL=https://your-vercel-domain`.

- [ ] Verify `.env.local` is in `.gitignore` (it already should be).

---

## Task 2 — `lib/spotify.ts`

**Files:** Create `lib/spotify.ts`

- [ ] Create the file with this exact content:

```typescript
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
  if (!res.ok) throw new Error(`Spotify token exchange ${res.status}`);
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
```

- [ ] Run typecheck — expect zero errors:
  ```
  npx tsc --noEmit
  ```

---

## Task 3 — OAuth login + callback routes

**Files:**
- Create `app/api/spotify/login/route.ts`
- Create `app/api/spotify/callback/route.ts`

- [ ] Create `app/api/spotify/login/route.ts`:

```typescript
import { NextResponse } from 'next/server';

const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
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
```

- [ ] Create `app/api/spotify/callback/route.ts`:

```typescript
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
  } catch {
    return NextResponse.redirect(new URL('/?spotify=error', req.url));
  }
}
```

- [ ] Run typecheck — expect zero errors.

---

## Task 4 — Token endpoint

**Files:** Create `app/api/spotify/token/route.ts`

This route is called by the client widget to get a fresh access token. It returns it in the JSON body (not just the cookie) so the browser JS / Spotify SDK can use it.

- [ ] Create `app/api/spotify/token/route.ts`:

```typescript
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
```

- [ ] Run typecheck — expect zero errors.

- [ ] Manual smoke-test (before building the widget): open `http://localhost:3000/api/spotify/login` in the browser. It should redirect you to `accounts.spotify.com`. Log in with a Spotify Premium account. After consent, you should be redirected back to `/?spotify=connected`. Then `GET http://localhost:3000/api/spotify/token` in the browser should return `{ "access_token": "BQA..." }`.

---

## Task 5 — SpotifyWidget component

**Files:**
- Create `components/spotify-widget.tsx`
- Create `components/spotify-widget.module.scss`

- [ ] Create `components/spotify-widget.tsx`:

```typescript
'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './spotify-widget.module.scss';

// ── Spotify SDK global types ────────────────────────────────────────────────

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: { Player: new (opts: SpotifyPlayerOpts) => SpotifyPlayer };
  }
}

interface SpotifyPlayerOpts {
  name        : string;
  getOAuthToken: (cb: (token: string) => void) => void;
  volume?     : number;
}

interface SpotifyPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener(event: 'ready' | 'not_ready', cb: (e: { device_id: string }) => void): boolean;
  addListener(event: 'player_state_changed', cb: (state: SpotifyState | null) => void): boolean;
  addListener(event: 'initialization_error' | 'authentication_error' | 'account_error' | 'playback_error', cb: (e: { message: string }) => void): boolean;
  togglePlay(): Promise<void>;
  previousTrack(): Promise<void>;
  nextTrack(): Promise<void>;
}

interface SpotifyState {
  paused      : boolean;
  position    : number;
  track_window: {
    current_track: {
      name   : string;
      artists: Array<{ name: string }>;
      album  : { name: string; images: Array<{ url: string }> };
    };
  };
}

// ── Component ───────────────────────────────────────────────────────────────

type ConnectedState = 'checking' | 'disconnected' | 'connected';

export function SpotifyWidget() {
  const [status,    setStatus]    = useState<ConnectedState>('checking');
  const [collapsed, setCollapsed] = useState(false);
  const [ready,     setReady]     = useState(false);
  const [track,     setTrack]     = useState<SpotifyState['track_window']['current_track'] | null>(null);
  const [paused,    setPaused]    = useState(true);

  const playerRef  = useRef<SpotifyPlayer | null>(null);
  const tokenRef   = useRef<string>('');

  async function fetchToken(): Promise<string | null> {
    try {
      const res = await fetch('/api/spotify/token');
      if (!res.ok) return null;
      const data = await res.json();
      tokenRef.current = data.access_token;
      return data.access_token;
    } catch {
      return null;
    }
  }

  // Check connection on mount
  useEffect(() => {
    fetchToken().then(token => {
      setStatus(token ? 'connected' : 'disconnected');
    });
  }, []);

  // Load SDK once connected
  useEffect(() => {
    if (status !== 'connected') return;

    const initPlayer = () => {
      const player = new window.Spotify!.Player({
        name        : 'MeliBoo',
        getOAuthToken: cb => { fetchToken().then(t => cb(t ?? '')); },
        volume      : 0.8,
      });

      player.addListener('ready', ({ device_id }) => {
        // Transfer playback to this device (no auto-play)
        fetch('https://api.spotify.com/v1/me/player', {
          method : 'PUT',
          headers: {
            Authorization : `Bearer ${tokenRef.current}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ device_ids: [device_id], play: false }),
        });
        setReady(true);
      });

      player.addListener('player_state_changed', state => {
        if (!state) return;
        setTrack(state.track_window.current_track);
        setPaused(state.paused);
      });

      player.addListener('authentication_error', () => setStatus('disconnected'));

      player.connect();
      playerRef.current = player;
    };

    if (window.Spotify?.Player) {
      initPlayer();
    } else {
      window.onSpotifyWebPlaybackSDKReady = initPlayer;
      if (!document.getElementById('spotify-sdk')) {
        const tag  = document.createElement('script');
        tag.id     = 'spotify-sdk';
        tag.src    = 'https://sdk.scdn.co/spotify-player.js';
        document.head.appendChild(tag);
      }
    }

    return () => {
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
  }, [status]);

  // ── Render: still checking ───────────────────────────────────────────────
  if (status === 'checking') return null;

  // ── Render: not connected ────────────────────────────────────────────────
  if (status === 'disconnected') {
    return (
      <div className={styles.widget}>
        <a href="/api/spotify/login" className={styles.connectBtn}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <path d="M7 1a6 6 0 1 0 0 12A6 6 0 0 0 7 1zm2.72 8.65c-.1.17-.33.22-.5.12C7.84 8.9 6.6 8.7 5.1 9.06c-.2.05-.4-.08-.44-.28a.36.36 0 0 1 .28-.44c1.65-.37 3.06-.13 4.27.64.17.1.22.33.12.5l-.61-.33zm.73-1.6c-.13.2-.4.27-.6.14C8.37 7.4 6.9 7.1 5.1 7.56c-.23.06-.47-.08-.53-.31a.43.43 0 0 1 .31-.53c2.04-.52 3.7-.17 5.1.77.2.13.27.4.14.6l-.67-.44zm.06-1.66C9.06 6 7.15 5.7 5.3 6.2a.5.5 0 1 1-.28-.96C7.06 4.7 9.2 5.04 10.7 6.07a.5.5 0 0 1-.19.92z"/>
          </svg>
          Connect Spotify
        </a>
      </div>
    );
  }

  // ── Render: connected ────────────────────────────────────────────────────
  const albumArt = track?.album.images[0]?.url;

  return (
    <div className={`${styles.widget} ${collapsed ? styles.collapsed : ''}`}>
      {!collapsed && (
        <>
          {albumArt
            ? /* eslint-disable-next-line @next/next/no-img-element */
              <img className={styles.albumArt} src={albumArt} alt={track?.album.name} />
            : (
              <div className={styles.musicIcon}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9 3v9.18A3 3 0 1 0 11 15V7h3V3H9z"/>
                </svg>
              </div>
            )
          }
          <div className={styles.info}>
            <span className={styles.trackName}>{track?.name ?? 'Not playing'}</span>
            <span className={styles.artist}>
              {track?.artists.map(a => a.name).join(', ') ?? '—'}
            </span>
          </div>
        </>
      )}

      <div className={styles.controls}>
        {!collapsed && (
          <button
            className={styles.ctrl}
            onClick={() => playerRef.current?.previousTrack()}
            disabled={!ready}
            title="Previous"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <path d="M8 1L3 5l5 4V1zM2 1h1.2v8H2V1z"/>
            </svg>
          </button>
        )}

        <button
          className={styles.ctrl}
          onClick={() => playerRef.current?.togglePlay()}
          disabled={!ready}
          title={paused ? 'Play' : 'Pause'}
        >
          {paused
            ? <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M2 1.5l7 3.5-7 3.5V1.5z"/></svg>
            : <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><rect x="1.5" y="1" width="3" height="8" rx="1"/><rect x="5.5" y="1" width="3" height="8" rx="1"/></svg>
          }
        </button>

        {!collapsed && (
          <button
            className={styles.ctrl}
            onClick={() => playerRef.current?.nextTrack()}
            disabled={!ready}
            title="Next"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <path d="M2 1l5 4-5 4V1zM6.8 1H8v8H6.8V1z"/>
            </svg>
          </button>
        )}

        <button
          className={styles.ctrl}
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed
            ? <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 6l3-3 3 3"/></svg>
            : <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 4l3 3 3-3"/></svg>
          }
        </button>
      </div>
    </div>
  );
}
```

- [ ] Create `components/spotify-widget.module.scss`:

```scss
.widget {
  display        : flex;
  align-items    : center;
  gap            : 10px;
  padding        : 10px 12px;
  border-radius  : 18px;
  background     : var(--card-bg);
  border         : 1px solid var(--border);
  box-shadow     : 0 4px 20px var(--shadow);
  max-width      : 240px;
  overflow       : hidden;
  transition     : max-width 0.2s ease, padding 0.2s ease, background 0.3s ease;
  backdrop-filter: blur(12px);
}

.collapsed {
  width    : 76px;
  max-width: 76px;
  min-width: 76px;
  padding  : 8px 11px;
}

.connectBtn {
  display        : flex;
  align-items    : center;
  gap            : 6px;
  font-family    : var(--font-lato), 'Lato', sans-serif;
  font-size      : 0.78rem;
  font-weight    : 500;
  color          : var(--color-accent);
  text-decoration: none;
  white-space    : nowrap;
}

.albumArt {
  width        : 40px;
  height       : 40px;
  border-radius: 8px;
  object-fit   : cover;
  flex-shrink  : 0;
}

.musicIcon {
  width          : 40px;
  height         : 40px;
  border-radius  : 10px;
  background     : var(--frosted);
  border         : 1px solid var(--border);
  display        : flex;
  align-items    : center;
  justify-content: center;
  flex-shrink    : 0;
  color          : var(--color-accent);
}

.info {
  flex          : 1;
  display       : flex;
  flex-direction: column;
  gap           : 2px;
  min-width     : 0;
}

.trackName {
  font-size    : 0.78rem;
  font-family  : var(--font-lato), 'Lato', sans-serif;
  color        : var(--color-primary);
  white-space  : nowrap;
  overflow     : hidden;
  text-overflow: ellipsis;
  font-weight  : 500;
}

.artist {
  font-size    : 0.68rem;
  color        : var(--color-secondary);
  opacity      : 0.65;
  white-space  : nowrap;
  overflow     : hidden;
  text-overflow: ellipsis;
}

.controls {
  display    : flex;
  align-items: center;
  gap        : 2px;
  flex-shrink: 0;
}

.ctrl {
  width          : 26px;
  height         : 26px;
  border-radius  : 50%;
  border         : none;
  background     : transparent;
  color          : var(--color-accent);
  font-size      : 1rem;
  cursor         : pointer;
  display        : flex;
  align-items    : center;
  justify-content: center;
  padding        : 0;
  transition     : background 0.15s;

  &:hover    { background: var(--frosted); }
  &:disabled { opacity: 0.35; cursor: not-allowed; }
}
```

- [ ] Run typecheck — expect zero errors:
  ```
  npx tsc --noEmit
  ```

---

## Task 6 — Mount in layout + clean up home page

**Files:**
- Modify `app/layout.tsx`
- Modify `app/page.tsx`
- Modify `app/page.module.scss`

- [ ] Update `app/layout.tsx` to include `SpotifyWidget` in a fixed bottom-right container:

```typescript
import type { Metadata } from 'next';
import { Playfair_Display, Lato } from 'next/font/google';
import './globals.scss';
import './tailwind.css';
import { ThemeProvider } from '@/components/theme-provider';
import { SpotifyWidget } from '@/components/spotify-widget';

const playfair = Playfair_Display({
  subsets : ['latin'],
  variable: '--font-playfair',
  style   : ['normal', 'italic'],
  display : 'swap',
});

const lato = Lato({
  subsets : ['latin'],
  weight  : ['300', '400', '700'],
  variable: '--font-lato',
  display : 'swap',
});

export const metadata: Metadata = {
  title: 'MeliBoo',
  icons: { icon: '/assets/sunflower.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${playfair.variable} ${lato.variable}`}>
        <ThemeProvider>
          {children}
          <div style={{
            position      : 'fixed',
            bottom        : '1.8rem',
            right         : '1.8rem',
            zIndex        : 50,
            display       : 'flex',
            flexDirection : 'column',
            alignItems    : 'flex-end',
            gap           : '0.6rem',
          }}>
            <SpotifyWidget />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] In `app/page.tsx`, remove the entire `{!showIntro && (<div className={styles.fixedBtns}>...</div>)}` block (the music widget section). Also remove all music state and refs:
  - Remove: `musicPlaying`, `widgetCollapsed` states
  - Remove: `audioRef`
  - Remove: the `useEffect` that creates the `<audio>` element
  - Remove: the `playPause` function
  - Remove: `import { ThemeToggle }` if no longer used on this page

  The ThemeToggle is now provided by `app/agent/page.tsx`'s topbar (agent) and will be added to the layout's fixed bar in the next step.

- [ ] Add `ThemeToggle` to the layout's fixed bar, below the `SpotifyWidget`:

```typescript
// In app/layout.tsx, update the fixed div children:
<SpotifyWidget />
<ThemeToggle />
```

  Import: `import { ThemeToggle } from '@/components/theme-toggle';`

  This means ThemeToggle appears on all pages from layout. Remove `<ThemeToggle>` from `app/page.tsx` `fixedBtns` if still present (can delete the entire `fixedBtns` div). Leave the ThemeToggle in `app/agent/page.tsx` topbar — having it in two places on agent is acceptable (topbar + fixed corner), or you can remove the one from the agent topbar.

- [ ] In `app/page.module.scss`, remove these classes (they are replaced by `spotify-widget.module.scss`):
  - `.musicCard`, `.musicCardCollapsed`, `.musicIcon`, `.musicInfo`, `.musicCardTitle`, `.musicCardArtist`, `.musicControls`, `.musicControl`
  - `.fixedBtns` (if the section is gone from `page.tsx`)
  - `.themeBtn` (if ThemeToggle is now in layout)

- [ ] Run typecheck — expect zero errors:
  ```
  npx tsc --noEmit
  ```

---

## Task 7 — End-to-end verification

- [ ] Start the dev server: `npm run dev`

- [ ] Open `http://localhost:3000`. The bottom-right corner shows **"Connect Spotify"** link.

- [ ] Click **Connect Spotify**. You are redirected to `accounts.spotify.com`. Log in with a Spotify **Premium** account. After consent, you are redirected back to `/?spotify=connected`.

- [ ] The widget now shows the music note icon (no track yet) with ‹ ▶ › and ↓ buttons.

- [ ] Open Spotify on your phone/desktop, start playing any song, then switch the active device to **"MeliBoo"**. The widget should update with album art and track name within a few seconds.

- [ ] Click ▶/⏸ — playback toggles. Click ‹ / › — track skips.

- [ ] Navigate to `http://localhost:3000/agent`. The widget is still visible in the bottom-right corner and music keeps playing.

- [ ] Click ↓ to collapse — only the play/pause and expand buttons remain.

- [ ] Commit:
  ```bash
  git add lib/spotify.ts \
          app/api/spotify/ \
          components/spotify-widget.tsx \
          components/spotify-widget.module.scss \
          app/layout.tsx \
          app/page.tsx \
          app/page.module.scss
  git commit -m "feat: replace audio player with Spotify Web Playback SDK"
  ```

---

## Verification checklist

| Check | Expected |
|-------|----------|
| `npx tsc --noEmit` | Zero errors |
| `/api/spotify/login` | Redirects to Spotify OAuth |
| `/api/spotify/callback?code=…` | Sets `sp_access` + `sp_refresh` cookies, redirects home |
| `/api/spotify/token` (after auth) | Returns `{ access_token: "BQA…" }` |
| `/api/spotify/token` (no cookie) | Returns `401 { error: "not_connected" }` |
| Home page — not logged in | Shows "Connect Spotify" button |
| Home page — logged in | Shows album art / music icon + controls |
| Agent page | Same widget visible bottom-right, music persists |
| Toggle play | Spotify toggles on the device |
| Collapse | Widget shrinks to 76px with just ▶ and ↑ |
| Page navigation | Music does not stop |

---

## Notes

- **Spotify Premium required** — the Web Playback SDK will not initialize on free accounts.
- **`sp_refresh` cookie** lasts 1 year — the user only needs to click "Connect Spotify" once per browser.
- **`sp_access` cookie** lasts `expires_in - 60` seconds (~59 min). The `/api/spotify/token` route auto-refreshes it silently.
- **Device transfer** — after the SDK player connects, it calls `PUT /v1/me/player` to make this browser the active device. The user still needs to start playback from within the Spotify app the first time or use the widget controls (if a track is already queued).
