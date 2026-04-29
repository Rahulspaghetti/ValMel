import type { Metadata } from 'next';
import { Cormorant_Garamond, DM_Sans } from 'next/font/google';
import './globals.scss';
import './tailwind.css';
import { ThemeProvider } from '@/components/theme-provider';
import { SpotifyWidget } from '@/components/spotify-widget';

const cormorant = Cormorant_Garamond({
  subsets : ['latin'],
  variable: '--font-cormorant',
  weight  : ['300', '400', '600'],
  style   : ['normal', 'italic'],
  display : 'swap',
});

const dmSans = DM_Sans({
  subsets : ['latin'],
  variable: '--font-dm-sans',
  weight  : ['300', '400', '500'],
  display : 'swap',
});

export const metadata: Metadata = {
  title: 'MeliBoo',
  icons: { icon: '/assets/sunflower.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${cormorant.variable} ${dmSans.variable}`}>
        <ThemeProvider>
          {children}
          <div style={{
            position      : 'fixed',
            bottom        : '1.8rem',
            left          : '1.8rem',
            zIndex        : 50,
            display       : 'flex',
            flexDirection : 'column',
            alignItems    : 'flex-start',
            gap           : '0.6rem',
          }}>
            <SpotifyWidget />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
