'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import styles from './page.module.scss';
import { ThemeToggle } from '@/components/theme-toggle';
import { SunflowerField } from '@/components/sunflower-field';
import { getMessage, msUntilMidnight } from '@/lib/messages';
import { getDailyVerse, BibleVerse } from '@/lib/bible';
import { getWeather, WeatherData, WeatherError } from '@/lib/weather';

const OWM_EMOJI: Record<string, string> = {
  '01d': '☀️', '01n': '🌙',
  '02d': '🌤', '02n': '🌤',
  '03d': '⛅', '03n': '⛅',
  '04d': '☁️', '04n': '☁️',
  '09d': '🌦', '09n': '🌦',
  '10d': '🌧', '10n': '🌧',
  '11d': '⛈',  '11n': '⛈',
  '13d': '🌨', '13n': '🌨',
  '50d': '🌫', '50n': '🌫',
};

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

  const loadBibleVerse = useCallback(() => {
    setBibleLoading(true);
    setBibleError(false);
    getDailyVerse()
      .then((v) => { setBibleVerse(v); setBibleLoading(false); })
      .catch(() => { setBibleError(true); setBibleLoading(false); });
  }, []);

  const loadWeather = useCallback(() => {
    setWeatherLoading(true);
    setWeatherError(null);
    getWeather()
      .then((d) => { setWeather(d); setWeatherLoading(false); })
      .catch((err: { type: WeatherError }) => {
        setWeatherError(err?.type ?? 'api');
        setWeatherLoading(false);
      });
  }, []);

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
  }, [greeting.text, loadBibleVerse, loadWeather]);

  function dismissIntro() {
    localStorage.setItem('valmell_greeting_seen', greeting.text);
    setShowIntro(false);
  }

  return (
    <>
      <div style={{ position: 'fixed', top: '1.2rem', right: '1.2rem', zIndex: 50 }}>
        <ThemeToggle />
      </div>

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

      <div className={styles.scene}>
        <SunflowerField />

        <div className={styles.page}>
          <header className={styles.header}>
            <h1 className={styles.title}>ValMel</h1>
            <p className={styles.subtitle}>a little corner just for you</p>
          </header>

          <main className={styles.cards}>

            {/* Bible card */}
            <article className={styles.card}>
              <div className={styles.cardLabel}>Scripture</div>
              <span className={styles.cardGlyph}>✦</span>
              {bibleLoading ? (
                <div className={styles.skeleton}>
                  <div className={styles.skeletonLine} />
                  <div className={styles.skeletonLine} />
                  <div className={`${styles.skeletonLine} ${styles.short}`} />
                </div>
              ) : bibleError ? (
                <>
                  <p className={styles.errorText}>Could not reach the Word today</p>
                  <button className={styles.retry} onClick={loadBibleVerse}>Try again</button>
                </>
              ) : (
                <blockquote className={styles.verse}>
                  <p className={styles.verseText}>{bibleVerse?.text}</p>
                  <cite className={styles.verseRef}>{bibleVerse?.reference}</cite>
                </blockquote>
              )}
            </article>

            {/* Weather card */}
            <article className={styles.card}>
              <div className={styles.cardLabel}>Weather</div>
              {weatherLoading ? (
                <div className={styles.loadingDots}>
                  <div className={styles.dotsRow}>
                    <span className={styles.dot} />
                    <span className={styles.dot} />
                    <span className={styles.dot} />
                  </div>
                  <span className={styles.loadingLabel}>fetching sky data</span>
                </div>
              ) : weatherError ? (
                <>
                  <p className={styles.errorText}>
                    {weatherError === 'location'
                      ? 'Location access denied — allow it and retry'
                      : 'Could not reach the skies today ☁️'}
                  </p>
                  <button className={styles.retry} onClick={loadWeather}>Try again</button>
                </>
              ) : (
                <div className={styles.weatherBody}>
                  <div className={styles.weatherIcon}>
                    {OWM_EMOJI[weather!.icon] ?? '🌤'}
                  </div>
                  <div className={styles.temp}>
                    {weather!.temperature}<sup className={styles.deg}>°C</sup>
                  </div>
                  <div className={styles.desc}>{weather!.description}</div>
                  <div className={styles.weatherDetails}>
                    <div className={styles.weatherRow}>
                      <span>Humidity</span><span>{weather!.humidity}%</span>
                    </div>
                    <div className={styles.weatherRow}>
                      <span>Wind</span><span>{weather!.windspeed} km/h</span>
                    </div>
                    <div className={styles.weatherRow}>
                      <span>Location</span><span>{weather!.city}</span>
                    </div>
                  </div>
                </div>
              )}
            </article>

            {/* Message card */}
            <article className={styles.card}>
              <div className={styles.cardLabel}>For You</div>
              <span className={styles.cardGlyph}>🌻</span>
              <p className={styles.messageText}>{cuteMessage}</p>
              <p className={styles.messageFrom}>— Hopefully your favorite person</p>
            </article>

          </main>

          <footer className={styles.footer}>
            <Link href="/agent" className={styles.agentLink}>
              Ask MeliBoo Law ✦
            </Link>
            <p>Made for you by Ra(h)ul</p>
            <Link href="/privacy-policy" className={styles.privacyLink}>
              Privacy Policy
            </Link>
          </footer>
        </div>
      </div>
    </>
  );
}
