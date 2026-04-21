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
  shuffle     : boolean;
  repeat_mode : number;   // 0 = off, 1 = context, 2 = track
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

interface Track {
  id     : string;
  uri    : string;
  name   : string;
  artists: string;
  art    : string | null;
}

// ── Component ───────────────────────────────────────────────────────────────

type ConnectedState = 'checking' | 'disconnected' | 'connected';

export function SpotifyWidget() {
  const [status,           setStatus]           = useState<ConnectedState>('checking');
  const [collapsed,        setCollapsed]        = useState(false);
  const [ready,            setReady]            = useState(false);
  const [deviceId,         setDeviceId]         = useState<string | null>(null);
  const [track,            setTrack]            = useState<SpotifyState['track_window']['current_track'] | null>(null);
  const [paused,           setPaused]           = useState(true);
  const [shuffle,          setShuffle]          = useState(false);
  const [repeatMode,       setRepeatMode]       = useState<0 | 1 | 2>(0);
  const [modalOpen,        setModalOpen]        = useState(false);
  const [playlists,        setPlaylists]        = useState<Playlist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [playlistsError,   setPlaylistsError]   = useState(false);
  const [playError,        setPlayError]        = useState(false);
  const [authError,        setAuthError]        = useState<string | null>(null);
  const [drillPlaylist,    setDrillPlaylist]    = useState<Playlist | null>(null);
  const [tracks,           setTracks]           = useState<Track[]>([]);
  const [tracksLoading,    setTracksLoading]    = useState(false);
  const [tracksError,      setTracksError]      = useState(false);

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
    const spotifyParam = params.get('spotify');
    if (spotifyParam === 'connected' || spotifyParam === 'error') {
      if (spotifyParam === 'error') {
        const reason = params.get('reason') ?? 'Unknown error';
        setAuthError(reason);
      }
      params.delete('spotify');
      params.delete('reason');
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
        setShuffle(state.shuffle);
        setRepeatMode(state.repeat_mode as 0 | 1 | 2);
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

  // ── Spotify PUT helper ────────────────────────────────────────────────────
  async function spotifyPut(path: string, body?: object) {
    const token = await fetchToken();
    if (!token) return;
    await fetch(`https://api.spotify.com/v1/me/player/${path}`, {
      method : 'PUT',
      headers: {
        Authorization : `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

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

  async function openPlaylistTracks(playlist: Playlist) {
    setDrillPlaylist(playlist);
    setTracksLoading(true);
    setTracksError(false);
    try {
      const token = await fetchToken();
      if (!token) throw new Error('no_token');
      const res = await fetch(
        `https://api.spotify.com/v1/playlists/${playlist.id}/tracks?fields=items(track(id,uri,name,artists(name),album(images)))&limit=50`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error('fetch_failed');
      const data = await res.json();
      const items: Track[] = (data.items ?? [])
        .filter((i: { track: { id: string; uri: string; name: string; artists: Array<{name: string}>; album: {images: Array<{url: string}>} } | null }) => i.track?.id)
        .map((i: { track: { id: string; uri: string; name: string; artists: Array<{name: string}>; album: {images: Array<{url: string}>} } }) => ({
          id     : i.track.id,
          uri    : i.track.uri,
          name   : i.track.name,
          artists: i.track.artists.map((a: { name: string }) => a.name).join(', '),
          art    : i.track.album.images[0]?.url ?? null,
        }));
      setTracks(items);
    } catch {
      setTracksError(true);
    } finally {
      setTracksLoading(false);
    }
  }

  async function playTrack(trackUri: string) {
    if (!deviceId || !drillPlaylist) return;
    setPlayError(false);
    try {
      const token = await fetchToken();
      if (!token) throw new Error('no_token');
      const res = await fetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
        {
          method : 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body   : JSON.stringify({ context_uri: drillPlaylist.uri, offset: { uri: trackUri } }),
        },
      );
      if (!res.ok) throw new Error('play_failed');
      setModalOpen(false);
      setDrillPlaylist(null);
    } catch {
      setPlayError(true);
    }
  }

  async function toggleShuffle() {
    if (!deviceId) return;
    const next = !shuffle;
    await spotifyPut(`shuffle?state=${next}&device_id=${deviceId}`);
    setShuffle(next);
  }

  async function cycleRepeat() {
    if (!deviceId) return;
    const states = ['off', 'context', 'track'] as const;
    const nextIdx = ((repeatMode + 1) % 3) as 0 | 1 | 2;
    await spotifyPut(`repeat?state=${states[nextIdx]}&device_id=${deviceId}`);
    setRepeatMode(nextIdx);
  }

  // ── Render: still checking ────────────────────────────────────────────────
  if (status === 'checking') return null;

  // ── Render: not connected ─────────────────────────────────────────────────
  if (status === 'disconnected') {
    return (
      <div className={styles.disconnectedWrap}>
        {authError && (
          <div className={styles.authError} title={authError}>
            Auth failed — check console
          </div>
        )}
        <div className={styles.widget}>
          <a href="/api/spotify/login" className={styles.connectBtn}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="currentColor">
              <path d="M7 1a6 6 0 1 0 0 12A6 6 0 0 0 7 1zm2.72 8.65c-.1.17-.33.22-.5.12C7.84 8.9 6.6 8.7 5.1 9.06c-.2.05-.4-.08-.44-.28a.36.36 0 0 1 .28-.44c1.65-.37 3.06-.13 4.27.64.17.1.22.33.12.5l-.61-.33zm.73-1.6c-.13.2-.4.27-.6.14C8.37 7.4 6.9 7.1 5.1 7.56c-.23.06-.47-.08-.53-.31a.43.43 0 0 1 .31-.53c2.04-.52 3.7-.17 5.1.77.2.13.27.4.14.6l-.67-.44zm.06-1.66C9.06 6 7.15 5.7 5.3 6.2a.5.5 0 1 1-.28-.96C7.06 4.7 9.2 5.04 10.7 6.07a.5.5 0 0 1-.19.92z"/>
            </svg>
            Connect Spotify
          </a>
        </div>
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
            {drillPlaylist ? (
              <button className={styles.backBtn} onClick={() => { setDrillPlaylist(null); setTracks([]); }}>
                <svg width="14" height="14" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L3 5l3 3"/>
                </svg>
              </button>
            ) : null}
            <span className={styles.modalTitle}>
              {drillPlaylist ? drillPlaylist.name : 'Your Playlists'}
            </span>
            <button className={styles.modalClose} onClick={() => { setModalOpen(false); setDrillPlaylist(null); setTracks([]); }}>✕</button>
          </div>

          {playError && <p className={styles.modalError}>Failed to start. Try again.</p>}

          {/* Playlist view */}
          {!drillPlaylist && (
            <>
              {playlistsLoading && (
                <div className={styles.modalList}>
                  {[0,1,2,3].map(i => <div key={i} className={styles.skeletonRow} />)}
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
                    <button key={p.id} className={styles.playlistRow} onClick={() => openPlaylistTracks(p)}>
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
            </>
          )}

          {/* Track view */}
          {drillPlaylist && (
            <>
              {tracksLoading && (
                <div className={styles.modalList}>
                  {[0,1,2,3,4].map(i => <div key={i} className={styles.skeletonRow} />)}
                </div>
              )}
              {tracksError && !tracksLoading && (
                <div className={styles.modalEmpty}>
                  <p>Couldn&apos;t load tracks.</p>
                  <button className={styles.retryBtn} onClick={() => openPlaylistTracks(drillPlaylist)}>Retry</button>
                </div>
              )}
              {!tracksLoading && !tracksError && (
                <div className={styles.modalList}>
                  {tracks.map(t => (
                    <button key={t.id} className={styles.playlistRow} onClick={() => playTrack(t.uri)}>
                      {t.art
                        ? /* eslint-disable-next-line @next/next/no-img-element */
                          <img className={styles.playlistThumb} src={t.art} alt={t.name} />
                        : <div className={styles.playlistThumbFallback} />
                      }
                      <div className={styles.playlistInfo}>
                        <span className={styles.playlistName}>{t.name}</span>
                        <span className={styles.playlistCount}>{t.artists}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Player widget */}
      <div className={`${styles.widget} ${collapsed ? styles.collapsed : ''}`}>
        {!collapsed && (
          <div className={styles.topRow}>
            {albumArt
              ? /* eslint-disable-next-line @next/next/no-img-element */
                <img className={styles.albumArt} src={albumArt} alt={track?.album.name ?? ''} />
              : (
                <div className={styles.musicIcon}>
                  <svg width="24" height="24" viewBox="0 0 20 20" fill="currentColor">
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
          </div>
        )}

        <div className={styles.controls}>
          {!collapsed && (
            <button
              className={`${styles.ctrl} ${shuffle ? styles.ctrlActive : ''}`}
              onClick={toggleShuffle}
              disabled={!ready}
              title={shuffle ? 'Shuffle on' : 'Shuffle off'}
            >
              {/* shuffle arrows SVG */}
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 4h8.5M1 10h8.5"/>
                <path d="M7.5 2l2.5 2-2.5 2"/>
                <path d="M7.5 8l2.5 2-2.5 2"/>
              </svg>
            </button>
          )}

          {!collapsed && (
            <button
              className={styles.ctrl}
              onClick={() => playerRef.current?.previousTrack()}
              disabled={!ready}
              title="Previous"
            >
              <svg width="12" height="12" viewBox="0 0 10 10" fill="currentColor">
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
              ? <svg width="12" height="12" viewBox="0 0 10 10" fill="currentColor"><path d="M2 1.5l7 3.5-7 3.5V1.5z"/></svg>
              : <svg width="12" height="12" viewBox="0 0 10 10" fill="currentColor"><rect x="1.5" y="1" width="3" height="8" rx="1"/><rect x="5.5" y="1" width="3" height="8" rx="1"/></svg>
            }
          </button>

          {!collapsed && (
            <button
              className={styles.ctrl}
              onClick={() => playerRef.current?.nextTrack()}
              disabled={!ready}
              title="Next"
            >
              <svg width="12" height="12" viewBox="0 0 10 10" fill="currentColor">
                <path d="M2 1l5 4-5 4V1zM6.8 1H8v8H6.8V1z"/>
              </svg>
            </button>
          )}

          {!collapsed && (
            <button
              className={`${styles.ctrl} ${repeatMode !== 0 ? styles.ctrlActive : ''}`}
              onClick={cycleRepeat}
              disabled={!ready}
              title={repeatMode === 0 ? 'Repeat off' : repeatMode === 1 ? 'Repeat playlist' : 'Repeat track'}
            >
              {repeatMode === 2
                ? (
                  /* repeat-one: arrow loop with "1" */
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 6V4a1 1 0 0 1 1-1h8"/>
                    <path d="M12 10V6"/>
                    <path d="M9 1l3 3-3 3"/>
                    <path d="M2 8v2a1 1 0 0 0 1 1h3"/>
                    <text x="5.5" y="11" fontSize="5" fill="currentColor" stroke="none" fontWeight="bold">1</text>
                  </svg>
                ) : (
                  /* repeat-all: standard loop arrows */
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 6V4a1 1 0 0 1 1-1h8"/>
                    <path d="M12 10V8"/>
                    <path d="M9 1l3 3-3 3"/>
                    <path d="M12 8l-3 3-3-3"/>
                    <path d="M2 8v2a1 1 0 0 0 1 1h8"/>
                  </svg>
                )
              }
            </button>
          )}

          {!collapsed && ready && deviceId && (
            <button
              className={styles.ctrl}
              onClick={openModal}
              title="Pick playlist"
            >
              <svg width="12" height="12" viewBox="0 0 10 10" fill="currentColor">
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
              ? <svg width="12" height="12" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 6l3-3 3 3"/></svg>
              : <svg width="12" height="12" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 4l3 3 3-3"/></svg>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
