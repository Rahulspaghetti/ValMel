'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SunflowerField } from '@/components/sunflower-field';
import { ThemeToggle } from '@/components/theme-toggle';
import { PinGate, PIN_KEY } from '@/components/pin-gate';
import styles from './videos.module.scss';

interface VideoSummary {
  id: number;
  title: string;
  thumbnail_url: string | null;
  duration: number | null;
  created_at: string;
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function VideosPage() {
  const [pin,     setPin]     = useState<string | null>(null);
  const [videos,  setVideos]  = useState<VideoSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Restore PIN from session if previously unlocked
  useEffect(() => {
    const saved = sessionStorage.getItem(PIN_KEY);
    if (saved) setPin(saved);
    else setLoading(false);
  }, []);

  // Fetch videos once PIN is known
  useEffect(() => {
    if (!pin) return;
    setLoading(true);
    fetch(`/api/videos?pin=${encodeURIComponent(pin)}`)
      .then(r => {
        if (r.status === 401) {
          sessionStorage.removeItem(PIN_KEY);
          setPin(null);
          return [];
        }
        return r.json();
      })
      .then(data => { setVideos(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [pin]);

  if (!pin) {
    return <PinGate title="Videos" onUnlock={setPin} />;
  }

  return (
    <div className={styles.scene}>
      <SunflowerField />
      <ThemeToggle />

      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Videos</h1>
          <p className={styles.subtitle}>A collection of memories</p>
        </header>

        <main className={styles.grid}>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={styles.skeletonCard}>
                <div className={styles.skeletonThumb} />
                <div className={styles.skeletonBody}>
                  <div className={styles.skeletonLine} />
                  <div className={`${styles.skeletonLine} ${styles.short}`} />
                </div>
              </div>
            ))
          ) : videos.length === 0 ? (
            <div className={styles.empty}>
              <p>Nothing to see here. Talk to Rahul to see wassup.</p>
            </div>
          ) : (
            videos.map(v => (
              <Link key={v.id} href={`/videos/${v.id}`} className={styles.card}>
                <div className={styles.thumbnail}>
                  {v.thumbnail_url ? (
                    <img src={v.thumbnail_url} alt={v.title} />
                  ) : (
                    <div className={styles.noThumb}>▶</div>
                  )}
                  <div className={styles.playOverlay}>
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="currentColor">
                      <circle cx="24" cy="24" r="22" fill="currentColor" fillOpacity="0.25" />
                      <polygon points="19,14 38,24 19,34" fill="currentColor" />
                    </svg>
                  </div>
                </div>
                <div className={styles.cardBody}>
                  <h2 className={styles.cardTitle}>{v.title}</h2>
                  {v.duration && (
                    <p className={styles.cardMeta}>{formatDuration(v.duration)}</p>
                  )}
                </div>
              </Link>
            ))
          )}
        </main>

        <footer className={styles.footer}>
          <Link href="/" className={styles.backLink}>← Home</Link>
        </footer>
      </div>
    </div>
  );
}
