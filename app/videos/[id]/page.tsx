'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { SunflowerField } from '@/components/sunflower-field';
import { ThemeToggle } from '@/components/theme-toggle';
import { VideoPlayer } from '@/components/video-player';
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
  const [video,   setVideo]   = useState<VideoFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    fetch(`/api/videos/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: VideoFull) => { setVideo(data); setLoading(false); })
      .catch(status => {
        setError(status === 404 ? 'Video not found.' : 'Failed to load video.');
        setLoading(false);
      });
  }, [id]);

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
            <VideoPlayer video={video} />
            {video.description && (
              <p className={styles.description}>{video.description}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
