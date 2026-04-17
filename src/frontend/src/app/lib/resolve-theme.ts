/**
 * resolve-theme.ts
 *
 * Pure utility for determining the correct initial theme from localStorage.
 * This logic mirrors the inline <script> in RootLayout (layout.tsx) that runs
 * before React hydration to prevent a flash of the wrong theme.
 *
 * Having it as a standalone module makes the logic unit-testable without
 * needing a browser or jsdom.
 *
 * Zustand persist stores state under the key 'stacksift-ui-preferences' as:
 *   { "state": { "theme": "dark" | "light" | "system", ... }, "version": 0 }
 */

export type ResolvedTheme = 'dark' | 'light';

/**
 * Reads the persisted theme preference and resolves it to a concrete value.
 *
 * @param storedJson  Raw JSON string from localStorage (or null if not set).
 * @param prefersDark Whether the OS reports prefers-color-scheme: dark.
 * @returns           'dark' or 'light' — never 'system'.
 */
export function resolveThemeFromStorage(
  storedJson: string | null,
  prefersDark: boolean,
): ResolvedTheme {
  try {
    if (storedJson) {
      const stored = JSON.parse(storedJson) as { state?: { theme?: string } };
      const theme = stored?.state?.theme;
      if (theme === 'dark') return 'dark';
      if (theme === 'light') return 'light';
      // 'system' or unrecognised value → fall through to OS preference below
    }
  } catch {
    // Corrupt localStorage entry — fall through to OS preference
  }
  return prefersDark ? 'dark' : 'light';
}
