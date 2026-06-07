'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { SunflowerField } from '@/components/sunflower-field';
import { ThemeToggle } from '@/components/theme-toggle';
import { VideoPlayer } from '@/components/video-player';
import { PinGate, PIN_KEY } from '@/components/pin-gate';
import styles from './player.module.scss';

interface Subtitle {
  id: number;
  language: string;
  label: string;
}

interface VideoFull {
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

export default function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [pin,     setPin]     = useState<string | null>(null);
  const [video,   setVideo]   = useState<VideoFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    const saved = sessionStorage.getItem(PIN_KEY);
    if (saved) setPin(saved);
    else setLoading(false);
  }, []);

  useEffect(() => {
    if (!pin) return;
    setLoading(true);
    fetch(`/api/videos/${id}?pin=${encodeURIComponent(pin)}`)
      .then(r => {
        if (r.status === 401) {
          sessionStorage.removeItem(PIN_KEY);
          setPin(null);
          return Promise.reject('unauthorized');
        }
        if (!r.ok) return Promise.reject(r.status);
        return r.json();
      })
      .then((data: VideoFull) => { setVideo(data); setLoading(false); })
      .catch(status => {
        if (status === 'unauthorized') return;
        setError(status === 404 ? 'Video not found.' : 'Failed to load video.');
        setLoading(false);
      });
  }, [id, pin]);

  if (!pin) {
    return <PinGate title="Videos" onUnlock={setPin} />;
  }

  return (
    <div className={styles.scene}>
      <SunflowerField />
      <ThemeToggle />

      <div className={styles.page}>
        <Link href="/videos" className={styles.back}>← Videos</Link>

        {loading && <p className={styles.state}>Loading…</p>}
        {error   && <p className={styles.state}>{error}</p>}

        {video && (
          <div className={styles.content}>
            <h1 className={styles.title}>{video.title}</h1>
            <VideoPlayer video={video} pin={pin} />
            {video.description && (
              <p className={styles.description}>{video.description}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
