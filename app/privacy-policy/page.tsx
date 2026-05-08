import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — MeliBoo',
};

export default function PrivacyPolicy() {
  return (
    <div style={{
      minHeight    : '100vh',
      padding      : '5rem 2rem 4rem',
      maxWidth     : '680px',
      margin       : '0 auto',
      display      : 'flex',
      flexDirection: 'column',
      gap          : '2rem',
    }}>
      <Link href="/" style={{
        fontFamily    : 'var(--font-dm-sans), "DM Sans", sans-serif',
        fontSize      : '0.75rem',
        letterSpacing : '0.16em',
        textTransform : 'uppercase',
        color         : 'var(--gold)',
        textDecoration: 'none',
        opacity       : 0.8,
      }}>
        ← Back
      </Link>

      <header style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <h1 style={{
          fontFamily  : 'var(--font-cormorant), "Cormorant Garamond", serif',
          fontWeight  : 300,
          fontStyle   : 'italic',
          fontSize    : 'clamp(2.2rem, 6vw, 3.5rem)',
          color       : 'var(--gold-pale)',
          letterSpacing: '0.06em',
          margin      : 0,
        }}>
          Privacy Policy
        </h1>
        <p style={{
          fontFamily   : 'var(--font-dm-sans), "DM Sans", sans-serif',
          fontSize     : '0.7rem',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color        : 'var(--text-dim)',
          margin       : 0,
        }}>
          Last updated: May 2025
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.8rem' }}>
        <Section title="What this site is">
          MeliBoo is a personal gift site made for one person. It displays a daily Bible verse,
          local weather, and a rotating message.
        </Section>

        <Section title="Data we collect">
          We collect no personal data and have no accounts or databases. Your browser may request
          your location to show local weather — this is handled entirely on your device and is
          never stored or transmitted to us.
        </Section>

        <Section title="Third-party services">
          The weather feature calls the OpenWeatherMap API with your coordinates. The Bible verse
          uses a public scripture API. The Spotify widget, if connected, uses Spotify&rsquo;s own
          OAuth flow — we store only the access token in your browser session.
        </Section>

        <Section title="Cookies &amp; storage">
          We use <code>localStorage</code> only to remember whether you have seen the greeting
          overlay. No tracking cookies, no analytics.
        </Section>

        <Section title="Contact">
          Questions? Email{' '}
          <a
            href="mailto:rahul.raji160899@gmail.com"
            style={{ color: 'var(--gold)', textDecoration: 'none' }}
          >
            rahul.raji160899@gmail.com
          </a>
          .
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
      <h2 style={{
        fontFamily   : 'var(--font-dm-sans), "DM Sans", sans-serif',
        fontSize     : '0.65rem',
        fontWeight   : 500,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color        : 'var(--gold)',
        opacity      : 0.85,
        margin       : 0,
      }}>
        {title}
      </h2>
      <p style={{
        fontFamily  : 'var(--font-dm-sans), "DM Sans", sans-serif',
        fontWeight  : 300,
        fontSize    : '0.92rem',
        lineHeight  : 1.75,
        color       : 'var(--text-dim)',
        margin      : 0,
      }}>
        {children}
      </p>
    </section>
  );
}
