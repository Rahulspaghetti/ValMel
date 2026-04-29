# Spotify Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persistent Spotify login + playlist-picker modal that shuffles and plays a chosen playlist via the in-page Spotify Web Playback SDK.

**Architecture:** Two new API routes proxy Spotify's REST API (playlists list + start playback). The widget gains `deviceId` state (from the SDK `ready` event), a URL-param fix for post-OAuth redirect, and a frosted-glass modal listing the user's playlists. Tokens persist via existing HTTP-only cookies — no DB changes.

**Tech Stack:** Next.js 15 App Router, TypeScript, Spotify Web API, Spotify Web Playback SDK, SCSS Modules

---

## File Map

| File | Action |
|------|--------|
| `app/api/spotify/playlists/route.ts` | Create — proxy `GET /me/playlists` |
| `app/api/spotify/play/route.ts` | Create — enable shuffle + start playback |
| `components/spotify-widget.tsx` | Modify — deviceId state, URL fix, modal |
| `components/spotify-widget.module.scss` | Modify — modal + playlist styles |

---

## Task 1: GET /api/spotify/playlists route

**Files:**
- Create: `app/api/spotify/playlists/route.ts`

- [ ] **Step 1: Create the file**

```typescript
// app/api/spotify/playlists/route.ts
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
      id: string;
      uri: string;
      name: string;
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
```

- [ ] **Step 2: Verify route responds (server must be running)**

```bash
curl -s http://127.0.0.1:3000/api/spotify/playlists
```

Expected without cookies: `{"error":"not_connected"}` with status 401. Expected with valid cookies: `{"playlists":[...]}`.

- [ ] **Step 3: Commit**

```bash
git add app/api/spotify/playlists/route.ts
git commit -m "feat: add GET /api/spotify/playlists proxy route"
```

---

## Task 2: POST /api/spotify/play route

**Files:**
- Create: `app/api/spotify/play/route.ts`

- [ ] **Step 1: Create the file**

```typescript
// app/api/spotify/play/route.ts
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
```

- [ ] **Step 2: Verify route responds**

```bash
curl -s -X POST http://127.0.0.1:3000/api/spotify/play \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: `{"error":"missing_params"}` with status 400.

- [ ] **Step 3: Commit**

```bash
git add app/api/spotify/play/route.ts
git commit -m "feat: add POST /api/spotify/play route"
```

---

## Task 3: Add modal styles to spotify-widget.module.scss

**Files:**
- Modify: `components/spotify-widget.module.scss`

- [ ] **Step 1: Add `position: relative` to `.widget` and append modal styles**

Add `position: relative;` to the existing `.widget` rule:

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
  overflow       : hidden; /* keep this — modal is outside widget div */
  transition     : max-width 0.2s ease, padding 0.2s ease, background 0.3s ease;
  backdrop-filter: blur(12px);
  position       : relative;
}
```

Wait — `overflow: hidden` on `.widget` will clip the modal if it's inside. The modal must live **outside** the `.widget` div but inside the outer wrapper in layout. See Task 4 for JSX structure. Keep `.widget` as-is; the outer fixed wrapper in `layout.tsx` provides the positioning context.

Append these classes to the **end** of `components/spotify-widget.module.scss`:

```scss
// ── Playlist modal ────────────────────────────────────────────────────────────

.modalWrap {
  position: relative;
}

.modal {
  position      : absolute;
  bottom        : calc(100% + 8px);
  right         : 0;
  width         : 260px;
  max-height    : 340px;
  background    : var(--card-bg-glass);
  backdrop-filter: blur(16px);
  border        : 1px solid var(--border);
  border-radius : 16px;
  box-shadow    : 0 8px 32px var(--shadow-hover);
  display       : flex;
  flex-direction: column;
  overflow      : hidden;
  z-index       : 100;
  transition    : background 0.3s ease;
}

.modalHeader {
  display        : flex;
  align-items    : center;
  justify-content: space-between;
  padding        : 12px 14px 10px;
  border-bottom  : 1px solid var(--border);
  flex-shrink    : 0;
}

.modalTitle {
  font-family   : var(--font-lato), 'Lato', sans-serif;
  font-size     : 0.75rem;
  font-weight   : 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color         : var(--color-secondary);
}

.modalClose {
  background: transparent;
  border    : none;
  color     : var(--color-secondary);
  cursor    : pointer;
  font-size : 0.75rem;
  padding   : 0;
  line-height: 1;
  opacity   : 0.6;

  &:hover { opacity: 1; }
}

.modalError {
  font-size : 0.72rem;
  color     : var(--color-accent);
  padding   : 6px 14px 0;
  margin    : 0;
}

.modalList {
  overflow-y: auto;
  flex      : 1;
  padding   : 6px 0;
}

.playlistRow {
  display    : flex;
  align-items: center;
  gap        : 10px;
  width      : 100%;
  padding    : 7px 14px;
  background : transparent;
  border     : none;
  cursor     : pointer;
  text-align : left;
  transition : background 0.1s;

  &:hover { background: var(--frosted); }
}

.playlistThumb {
  width        : 36px;
  height       : 36px;
  border-radius: 6px;
  object-fit   : cover;
  flex-shrink  : 0;
}

.playlistThumbFallback {
  width        : 36px;
  height       : 36px;
  border-radius: 6px;
  background   : var(--frosted);
  border       : 1px solid var(--border);
  flex-shrink  : 0;
}

.playlistInfo {
  display       : flex;
  flex-direction: column;
  gap           : 2px;
  min-width     : 0;
}

.playlistName {
  font-family  : var(--font-lato), 'Lato', sans-serif;
  font-size    : 0.78rem;
  font-weight  : 500;
  color        : var(--color-primary);
  white-space  : nowrap;
  overflow     : hidden;
  text-overflow: ellipsis;
}

.playlistCount {
  font-size: 0.68rem;
  color    : var(--color-secondary);
  opacity  : 0.65;
}

.skeletonRow {
  height         : 50px;
  margin         : 4px 14px;
  border-radius  : 8px;
  background     : linear-gradient(90deg, var(--border) 25%, var(--bg-end) 50%, var(--border) 75%);
  background-size: 200% 100%;
  animation      : shimmer 1.4s ease-in-out infinite;
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.modalEmpty {
  display       : flex;
  flex-direction: column;
  align-items   : center;
  gap           : 8px;
  padding       : 20px 14px;
  font-size     : 0.78rem;
  color         : var(--color-secondary);

  p { margin: 0; }
}

.retryBtn {
  background   : var(--frosted);
  border       : 1px solid var(--border);
  border-radius: 8px;
  padding      : 4px 12px;
  font-size    : 0.72rem;
  color        : var(--color-accent);
  cursor       : pointer;

  &:hover { background: var(--frosted-hover); }
}
```

- [ ] **Step 2: Verify no SCSS compile errors in server output** — check terminal running `npm run dev`, no red errors.

- [ ] **Step 3: Commit**

```bash
git add components/spotify-widget.module.scss
git commit -m "feat: add playlist modal styles to spotify widget"
```

---

## Task 4: Update SpotifyWidget component

**Files:**
- Modify: `components/spotify-widget.tsx`

This task replaces the entire file. The changes are: new state (`deviceId`, `modalOpen`, `playlists`, `playlistsLoading`, `playlistsError`, `playError`), URL-param fix on mount, `deviceId` lifted from SDK `ready` event, `openModal` and `playPlaylist` functions, playlist button in controls, and the modal JSX. The outer JSX is wrapped in a `<div className={styles.modalWrap}>` so the modal can position above the widget without being clipped.

- [ ] **Step 1: Replace `components/spotify-widget.tsx` with the following**

```typescript
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './spotify-widget.module.scss';

// ── Spotify SDK global types ────────────────────────────────────────────────

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: { Player: new (opts: SpotifyPlayerOpts) => SpotifyPlayer };
  }
}

interface SpotifyPlayerOpts {
  name         : string;
  getOAuthToken: (cb: (token: string) => void) => void;
  volume?      : number;
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

interface Playlist {
  id        : string;
  uri       : string;
  name      : string;
  imageUrl  : string | null;
  trackCount: number;
}

// ── Component ───────────────────────────────────────────────────────────────

type ConnectedState = 'checking' | 'disconnected' | 'connected';

export function SpotifyWidget() {
  const [status,          setStatus]          = useState<ConnectedState>('checking');
  const [collapsed,       setCollapsed]       = useState(false);
  const [ready,           setReady]           = useState(false);
  const [deviceId,        setDeviceId]        = useState<string | null>(null);
  const [track,           setTrack]           = useState<SpotifyState['track_window']['current_track'] | null>(null);
  const [paused,          setPaused]          = useState(true);
  const [modalOpen,       setModalOpen]       = useState(false);
  const [playlists,       setPlaylists]       = useState<Playlist[]>([]);
  const [playlistsLoading,setPlaylistsLoading]= useState(false);
  const [playlistsError,  setPlaylistsError]  = useState(false);
  const [playError,       setPlayError]       = useState(false);

  const playerRef = useRef<SpotifyPlayer | null>(null);
  const tokenRef  = useRef<string>('');

  const fetchToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/spotify/token');
      if (!res.ok) return null;
      const data = await res.json();
      tokenRef.current = data.access_token;
      return data.access_token;
    } catch {
      return null;
    }
  }, []);

  // ── Check connection on mount; strip ?spotify=connected from URL ──────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('spotify') === 'connected') {
      params.delete('spotify');
      const newSearch = params.toString();
      window.history.replaceState(
        {},
        '',
        newSearch ? `?${newSearch}` : window.location.pathname,
      );
    }
    fetchToken().then(token => {
      setStatus(token ? 'connected' : 'disconnected');
    });
  }, [fetchToken]);

  // ── Load SDK once connected ───────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'connected') return;

    const initPlayer = () => {
      const player = new window.Spotify!.Player({
        name         : 'MeliBoo',
        getOAuthToken: cb => { fetchToken().then(t => cb(t ?? '')); },
        volume       : 0.8,
      });

      player.addListener('ready', async ({ device_id }) => {
        setDeviceId(device_id);
        const token = await fetchToken();
        if (!token) return;
        const res = await fetch('https://api.spotify.com/v1/me/player', {
          method : 'PUT',
          headers: {
            Authorization : `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ device_ids: [device_id], play: false }),
        });
        if (res.ok || res.status === 204) setReady(true);
      });

      player.addListener('player_state_changed', state => {
        if (!state) return;
        setTrack(state.track_window.current_track);
        setPaused(state.paused);
      });

      player.addListener('authentication_error', () => setStatus('disconnected'));
      player.addListener('not_ready', () => setReady(false));

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
      if (window.onSpotifyWebPlaybackSDKReady === initPlayer) {
        window.onSpotifyWebPlaybackSDKReady = undefined;
      }
    };
  }, [status, fetchToken]);

  // ── Playlist modal helpers ────────────────────────────────────────────────
  async function openModal() {
    setModalOpen(true);
    setPlaylistsLoading(true);
    setPlaylistsError(false);
    setPlayError(false);
    try {
      const res = await fetch('/api/spotify/playlists');
      if (!res.ok) throw new Error('fetch_failed');
      const data = await res.json() as { playlists: Playlist[] };
      setPlaylists(data.playlists);
    } catch {
      setPlaylistsError(true);
    } finally {
      setPlaylistsLoading(false);
    }
  }

  async function playPlaylist(uri: string) {
    if (!deviceId) return;
    setPlayError(false);
    try {
      const res = await fetch('/api/spotify/play', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ playlistUri: uri, deviceId }),
      });
      if (!res.ok) throw new Error('play_failed');
      setModalOpen(false);
    } catch {
      setPlayError(true);
    }
  }

  // ── Render: still checking ────────────────────────────────────────────────
  if (status === 'checking') return null;

  // ── Render: not connected ─────────────────────────────────────────────────
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

  // ── Render: connected ─────────────────────────────────────────────────────
  const albumArt = track?.album.images[0]?.url;

  return (
    <div className={styles.modalWrap}>
      {/* Playlist modal */}
      {modalOpen && (
        <div className={styles.modal}>
          <div className={styles.modalHeader}>
            <span className={styles.modalTitle}>Your Playlists</span>
            <button className={styles.modalClose} onClick={() => setModalOpen(false)}>✕</button>
          </div>
          {playError && <p className={styles.modalError}>Failed to start. Try again.</p>}

          {playlistsLoading && (
            <div className={styles.modalList}>
              {[0, 1, 2, 3].map(i => <div key={i} className={styles.skeletonRow} />)}
            </div>
          )}

          {playlistsError && !playlistsLoading && (
            <div className={styles.modalEmpty}>
              <p>Couldn&apos;t load playlists.</p>
              <button className={styles.retryBtn} onClick={openModal}>Retry</button>
            </div>
          )}

          {!playlistsLoading && !playlistsError && (
            <div className={styles.modalList}>
              {playlists.map(p => (
                <button key={p.id} className={styles.playlistRow} onClick={() => playPlaylist(p.uri)}>
                  {p.imageUrl
                    ? /* eslint-disable-next-line @next/next/no-img-element */
                      <img className={styles.playlistThumb} src={p.imageUrl} alt={p.name} />
                    : <div className={styles.playlistThumbFallback} />
                  }
                  <div className={styles.playlistInfo}>
                    <span className={styles.playlistName}>{p.name}</span>
                    <span className={styles.playlistCount}>{p.trackCount} tracks</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Player widget */}
      <div className={`${styles.widget} ${collapsed ? styles.collapsed : ''}`}>
        {!collapsed && (
          <>
            {albumArt
              ? /* eslint-disable-next-line @next/next/no-img-element */
                <img className={styles.albumArt} src={albumArt} alt={track?.album.name ?? ''} />
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

          {!collapsed && ready && deviceId && (
            <button
              className={styles.ctrl}
              onClick={openModal}
              title="Pick playlist"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <rect x="0" y="1"    width="10" height="1.5" rx="0.75"/>
                <rect x="0" y="4.25" width="7.5" height="1.5" rx="0.75"/>
                <rect x="0" y="7.5"  width="5"   height="1.5" rx="0.75"/>
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
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "C:/Users/rahul/Desktop/Code/Claude Projects/ValMel"
npx tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **Step 3: Verify in browser**

1. Open `http://127.0.0.1:3000` in browser
2. If not connected: click "Connect Spotify" → authorize → redirected back → widget shows "Not playing" (no re-login prompt)
3. Once SDK is ready (a few seconds): playlist button (three lines) appears in controls
4. Click playlist button → modal slides up with your playlists
5. Click a playlist → modal closes → widget shows now-playing track within a few seconds

- [ ] **Step 4: Commit**

```bash
git add components/spotify-widget.tsx
git commit -m "feat: add playlist modal, deviceId state, and URL param fix to SpotifyWidget"
```

---

## Manual Verification Checklist

- [ ] Connect Spotify (first time) → tokens saved in cookies → no login on next visit
- [ ] Hard-refresh page → widget shows player immediately (not "Connect Spotify")
- [ ] Playlist modal opens with cover art + track counts
- [ ] Clicking a playlist starts shuffled playback within ~3 seconds
- [ ] Prev / Play-Pause / Next controls work once playing
- [ ] Collapsing widget hides playlist button and track info
