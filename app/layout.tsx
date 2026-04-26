import type { Metadata } from 'next';
import { Playfair_Display, Lato } from 'next/font/google';
import './globals.scss';
import './tailwind.css';
import { ThemeProvider } from '@/components/theme-provider';
import { SpotifyWidget } from '@/components/spotify-widget';

const playfair = Playfair_Display({
  subsets : ['latin'],
  variable: '--font-playfair',
  style   : ['normal', 'italic'],
  display : 'swap',
});

const lato = Lato({
  subsets : ['latin'],
  weight  : ['300', '400', '700'],
  variable: '--font-lato',
  display : 'swap',
});

export const metadata: Metadata = {
  title: 'MeliBoo',
  icons: { icon: '/assets/sunflower.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${playfair.variable} ${lato.variable}`}>
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
