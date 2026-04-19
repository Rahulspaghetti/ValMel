'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { AutoTheme } from './auto-theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <AutoTheme />
      {children}
    </NextThemesProvider>
  );
}
