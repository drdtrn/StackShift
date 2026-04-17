'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/app/hooks/useUIStore';

/**
 * useThemeEffect
 *
 * Reads `theme` from Zustand's UIStore (persisted to localStorage) and
 * applies the corresponding CSS classes to <html>:
 *
 *   'dark'   → add 'dark',  remove 'light'
 *   'light'  → add 'light', remove 'dark'
 *   'system' → delegate to OS prefers-color-scheme; listen for changes
 *
 * Call this once at the top of the component tree (Providers.tsx).
 * Runs only in the browser (useEffect is client-only).
 */
export function useThemeEffect() {
  const theme = useUIStore((state) => state.theme);

  useEffect(() => {
    const html = document.documentElement;

    function applyTheme(resolved: 'dark' | 'light') {
      if (resolved === 'dark') {
        html.classList.add('dark');
        html.classList.remove('light');
      } else {
        html.classList.add('light');
        html.classList.remove('dark');
      }
    }

    if (theme === 'dark') {
      applyTheme('dark');
      return;
    }

    if (theme === 'light') {
      applyTheme('light');
      return;
    }

    // theme === 'system': delegate to OS preference
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    applyTheme(mediaQuery.matches ? 'dark' : 'light');

    const handleChange = (e: MediaQueryListEvent) => {
      applyTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [theme]);
}
