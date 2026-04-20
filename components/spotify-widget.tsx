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

      player.addListener('ready', async ({ device_id }) => {
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
