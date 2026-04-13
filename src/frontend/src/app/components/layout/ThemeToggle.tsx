'use client';

import { Moon, Sun, Monitor } from 'lucide-react';
import { useUIStore, type Theme } from '@/app/hooks/useUIStore';

// ---------------------------------------------------------------------------
// ThemeToggle
//
// An icon button that cycles: dark → light → system → dark.
// Icons: Moon (dark), Sun (light), Monitor (system).
//
// No SSR guard needed: ThemeToggle is always rendered inside AppShell
// ('use client'), so it only ever runs in the browser.
// ---------------------------------------------------------------------------

const CYCLE: Theme[] = ['dark', 'light', 'system'];

const ICONS: Record<Theme, React.ReactNode> = {
  dark:   <Moon    className="h-5 w-5" aria-hidden="true" />,
  light:  <Sun     className="h-5 w-5" aria-hidden="true" />,
  system: <Monitor className="h-5 w-5" aria-hidden="true" />,
};

const NEXT_LABELS: Record<Theme, string> = {
  dark:   'Switch to light mode',
  light:  'Switch to system mode',
  system: 'Switch to dark mode',
};

export function ThemeToggle() {
  const { theme, setTheme } = useUIStore();

  const cycleTheme = () => {
    const currentIndex = CYCLE.indexOf(theme);
    const nextTheme = CYCLE[(currentIndex + 1) % CYCLE.length];
    setTheme(nextTheme);
  };

  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={NEXT_LABELS[theme]}
      className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      {ICONS[theme]}
    </button>
  );
}
