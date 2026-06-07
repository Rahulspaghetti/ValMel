'use client';

import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import styles from './video-player.module.scss';

interface Subtitle {
  id: number;
  language: string;
  label: string;
}

interface VideoData {
  id: number;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  url_360p: string | null;
  url_720p: string | null;
  url_1080p: string | null;
  duration: number | null;
  subtitles: Subtitle[];
}

interface Quality {
  label: string;
  url: string;
}

export function VideoPlayer({ video, pin }: { video: VideoData; pin?: string }) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const pendingSeek = useRef(0);
  const wasPlaying  = useRef(false);

  const qualities = useMemo<Quality[]>(() => {
    const q: Quality[] = [];
    if (video.url_1080p) q.push({ label: '1080p', url: video.url_1080p });
    if (video.url_720p)  q.push({ label: '720p',  url: video.url_720p });
    if (video.url_360p)  q.push({ label: '360p',  url: video.url_360p });
    return q;
  }, [video]);

  const defaultIdx = useMemo(() => {
    const i = qualities.findIndex(q => q.label === '720p');
    return i >= 0 ? i : 0;
  }, [qualities]);

  const [qualityIdx, setQualityIdx] = useState(defaultIdx);

  function switchQuality(idx: number) {
    const el = videoRef.current;
    if (!el || idx === qualityIdx) return;
    pendingSeek.current = el.currentTime;
    wasPlaying.current  = !el.paused;
    setQualityIdx(idx);
  }

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const restore = () => {
      el.currentTime = pendingSeek.current;
      if (wasPlaying.current) el.play();
    };
    el.addEventListener('loadedmetadata', restore, { once: true });
  }, [qualityIdx]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const el = videoRef.current;
    if (!el) return;
    switch (e.key) {
      case ' ':
      case 'k':
      case 'K':
        e.preventDefault();
        el.paused ? el.play() : el.pause();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        el.currentTime = Math.max(0, el.currentTime - 5);
        break;
      case 'ArrowRight':
        e.preventDefault();
        el.currentTime = Math.min(el.duration, el.currentTime + 5);
        break;
      case 'ArrowUp':
        e.preventDefault();
        el.volume = Math.min(1, el.volume + 0.1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        el.volume = Math.max(0, el.volume - 0.1);
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        if (!document.fullscreenElement) el.requestFullscreen();
        else document.exitFullscreen();
        break;
      case 'm':
      case 'M':
        e.preventDefault();
        el.muted = !el.muted;
        break;
    }
  }, []);

  if (qualities.length === 0) {
    return <p className={styles.noSource}>No video sources available.</p>;
  }

  return (
    <div
      className={styles.wrapper}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label="Video player"
    >
      <video
        ref={videoRef}
        key={qualities[qualityIdx].url}
        src={qualities[qualityIdx].url}
        controls
        preload="metadata"
        poster={video.thumbnail_url ?? undefined}
        crossOrigin="anonymous"
        className={styles.video}
      >
        {video.subtitles.map(s => (
          <track
            key={s.id}
            kind="subtitles"
            srcLang={s.language}
            label={s.label}
            src={pin ? `/api/subtitles/${s.id}?pin=${encodeURIComponent(pin)}` : `/api/subtitles/${s.id}`}
            default={s.language === 'en'}
          />
        ))}
      </video>

      <div className={styles.controls}>
        {qualities.length > 1 && (
          <>
            <label htmlFor="quality-select" className={styles.qualityLabel}>Quality</label>
            <select
              id="quality-select"
              className={styles.qualitySelect}
              value={qualityIdx}
              onChange={e => switchQuality(Number(e.target.value))}
            >
              {qualities.map((q, i) => (
                <option key={q.label} value={i}>{q.label}</option>
              ))}
            </select>
          </>
        )}
        <p className={styles.hint}>
          Space/K play · ←→ seek 5s · ↑↓ volume · F fullscreen · M mute
        </p>
      </div>
    </div>
  );
}
