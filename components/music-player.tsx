'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './music-player.module.scss';

const TRACK = '/assets/music.mp3';

export function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = new Audio(TRACK);
    audio.loop = true;
    audio.volume = 0.5;
    audioRef.current = audio;
    return () => { audio.pause(); audioRef.current = null; };
  }, []);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  }

  return (
    <button
      type="button"
      className={`${styles.btn} ${playing ? styles.playing : ''}`}
      onClick={toggle}
      title={playing ? 'Pause music' : 'Play music'}
      aria-label={playing ? 'Pause music' : 'Play music'}
    >
      {playing ? '♪' : '♩'}
    </button>
  );
}
