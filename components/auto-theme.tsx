'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';

// Dark: 6PM (18:00) → 10AM (10:00) next day. Light: 10AM → 6PM.
function getThemeForHour(hour: number): 'dark' | 'light' {
  return (hour >= 18 || hour < 10) ? 'dark' : 'light';
}

function msUntilNextSwitch(): number {
  const now  = new Date();
  const hour = now.getHours();
  const next = new Date(now);

  if (hour >= 18) {
    // After 6PM — next switch is 10AM tomorrow
    next.setDate(next.getDate() + 1);
    next.setHours(10, 0, 0, 0);
  } else if (hour < 10) {
    // Before 10AM — next switch is 10AM today
    next.setHours(10, 0, 0, 0);
  } else {
    // Between 10AM–6PM — next switch is 6PM today
    next.setHours(18, 0, 0, 0);
  }

  return next.getTime() - now.getTime();
}

export function AutoTheme() {
  const { setTheme } = useTheme();

  useEffect(() => {
    // Only set on mount if no stored preference exists (localStorage empty)
    const stored = localStorage.getItem('theme');
    if (!stored || stored === 'system') {
      setTheme(getThemeForHour(new Date().getHours()));
    }

    const schedule = () => {
      const delay = msUntilNextSwitch();
      const t = setTimeout(() => {
        setTheme(getThemeForHour(new Date().getHours()));
        schedule();
      }, delay);
      return t;
    };

    const t = schedule();
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
