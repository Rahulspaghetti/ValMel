'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './page.module.scss';
import { getMessage, msUntilMidnight } from '@/lib/messages';
import { getDailyVerse, BibleVerse } from '@/lib/bible';
import { getWeather, WeatherData, WeatherError } from '@/lib/weather';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

function getGreeting(): { text: string; emoji: string } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12)  return { text: 'Good Morning',             emoji: '☀️' };
  if (hour >= 12 && hour < 17) return { text: 'Good Afternoon',           emoji: '🌸' };
  if (hour >= 17 && hour < 21) return { text: 'Good Evening',             emoji: '🌅' };
  return                               { text: 'Goodnight mi chula reina', emoji: '🌙' };
}

export default function Home() {
  const [showIntro, setShowIntro]           = useState<boolean | null>(null);
  const [greeting]                          = useState(getGreeting);

  const [bibleVerse, setBibleVerse]         = useState<BibleVerse | null>(null);
  const [bibleLoading, setBibleLoading]     = useState(true);
  const [bibleError, setBibleError]         = useState(false);

  const [weather, setWeather]               = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError]     = useState<WeatherError | null>(null);

  const [cuteMessage, setCuteMessage]       = useState('');

  useEffect(() => {
    const seen = localStorage.getItem('valmell_greeting_seen');
    setShowIntro(seen !== greeting.text);

    setCuteMessage(getMessage());
    loadBibleVerse();
    loadWeather();

    const timer = setTimeout(() => {
      setCuteMessage(getMessage());
      loadBibleVerse();
    }, msUntilMidnight());
    return () => clearTimeout(timer);
  }, []);

  function loadBibleVerse() {
    setBibleLoading(true);
    setBibleError(false);
    getDailyVerse()
      .then((v) => { setBibleVerse(v); setBibleLoading(false); })
      .catch(() => { setBibleError(true); setBibleLoading(false); });
  }

  function loadWeather() {
    setWeatherLoading(true);
    setWeatherError(null);
    getWeather()
      .then((d) => { setWeather(d); setWeatherLoading(false); })
      .catch((err: { type: WeatherError }) => {
        setWeatherError(err?.type ?? 'api');
        setWeatherLoading(false);
      });
  }

  function dismissIntro() {
    localStorage.setItem('valmell_greeting_seen', greeting.text);
    setShowIntro(false);
  }

  const flowerStyle = { backgroundImage: `url('${BASE}/assets/sunflower.png')` };

  return (
    <>
      {showIntro && (
        <div className={styles.introOverlay} onClick={dismissIntro}>
          <div className={styles.introBox}>
            <p className={styles.introGreeting}>
              {greeting.text} <span className={styles.emoji}>{greeting.emoji}</span>
            </p>
            <p className={styles.introTitle}>MeliBoo</p>
            <p className={styles.introHint}>tap to open ✦</p>
          </div>
        </div>
      )}

      <div className={styles.flowers} aria-hidden="true">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <span key={i} className={`${styles.flower} ${styles[`f${i}`]}`} style={flowerStyle} />
        ))}
      </div>

      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Supreme Leader</h1>
          <p className={styles.subtitle}>just for you</p>
        </header>

        <main className={styles.cards}>

          <article className={`${styles.card} ${styles.bibleCard}`}>
            <span className={styles.cardGlyph}>✦</span>
            <h2 className={styles.cardLabel}>Today's Word</h2>
            {bibleLoading ? (
              <div className={styles.skeleton}>
                <div className={styles.skeletonLine} />
                <div className={styles.skeletonLine} />
                <div className={`${styles.skeletonLine} ${styles.short}`} />
              </div>
            ) : bibleError ? (
              <>
                <p className={styles.errorText}>Could not load verse</p>
                <button className={styles.retry} onClick={loadBibleVerse}>Try again</button>
              </>
            ) : (
              <blockquote className={styles.verse}>
                <p className={styles.verseText}>{bibleVerse?.text}</p>
                <cite className={styles.verseRef}>{bibleVerse?.reference}</cite>
              </blockquote>
            )}
          </article>

          <article className={`${styles.card} ${styles.weatherCard}`}>
            <span className={styles.cardGlyph}>☁</span>
            <h2 className={styles.cardLabel}>Right Now</h2>
            {weatherLoading ? (
              <div className={styles.skeleton}>
                <div className={`${styles.skeletonLine} ${styles.short} ${styles.center}`} />
                <div className={`${styles.skeletonLine} ${styles.short} ${styles.center}`} />
                <div className={`${styles.skeletonLine} ${styles.shorter} ${styles.center}`} />
              </div>
            ) : weatherError ? (
              <>
                <p className={styles.errorText}>
                  {weatherError === 'location'
                    ? <>Location access was denied.<br />Allow it in your browser and retry.</>
                    : <>Weather API error.<br />Check your API key.</>
                  }
                </p>
                <button className={styles.retry} onClick={loadWeather}>Try again</button>
              </>
            ) : (
              <div className={styles.weatherBody}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.weatherIcon} src={weather!.icon} alt={weather!.description} />
                <div className={styles.temp}>
                  {weather!.temperature}<span className={styles.deg}>°C</span>
                </div>
                <div className={styles.city}>{weather!.city}</div>
                <div className={styles.desc}>{weather!.description}</div>
                <div className={styles.feels}>feels like {weather!.feelsLike}°C</div>
              </div>
            )}
          </article>

          <article className={`${styles.card} ${styles.messageCard}`}>
            <span className={styles.cardGlyph}>♡</span>
            <h2 className={styles.cardLabel}>A Little Note</h2>
            <p className={styles.messageText}>{cuteMessage}</p>
          </article>

        </main>

        <footer className={styles.footer}>
          <Link href="/agent" className={styles.agentLink}>
            Ask MeliBoo Law ✦
          </Link>
          <p>Made for you by Ra(h)ul</p>
        </footer>
      </div>
    </>
  );
}
