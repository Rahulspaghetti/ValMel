import type { Metadata } from 'next';
import { Playfair_Display, Lato } from 'next/font/google';
import './globals.scss';
import './tailwind.css';
import { ThemeProvider } from '@/components/theme-provider';
import { SpotifyWidget } from '@/components/spotify-widget';
import { ThemeToggle } from '@/components/theme-toggle';

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
            right         : '1.8rem',
            zIndex        : 50,
            display       : 'flex',
            flexDirection : 'column',
            alignItems    : 'flex-end',
            gap           : '0.6rem',
          }}>
            <SpotifyWidget />
            <ThemeToggle />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
