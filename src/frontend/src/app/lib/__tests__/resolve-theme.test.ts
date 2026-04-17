/**
 * Tests for resolveThemeFromStorage (US-07 AC #2)
 *
 * Validates: "Mode preference read from localStorage on initial load — no flash
 * of wrong theme." The anti-FOUC inline script in RootLayout (layout.tsx) uses
 * this exact logic to apply 'dark' or 'light' to <html> before React hydrates.
 */

import { resolveThemeFromStorage } from '../resolve-theme';

describe('resolveThemeFromStorage — explicit preferences', () => {
  it('returns "dark" when stored theme is "dark"', () => {
    const stored = JSON.stringify({ state: { theme: 'dark' } });
    // OS preference should be ignored when an explicit preference exists
    expect(resolveThemeFromStorage(stored, false)).toBe('dark');
    expect(resolveThemeFromStorage(stored, true)).toBe('dark');
  });

  it('returns "light" when stored theme is "light"', () => {
    const stored = JSON.stringify({ state: { theme: 'light' } });
    expect(resolveThemeFromStorage(stored, false)).toBe('light');
    expect(resolveThemeFromStorage(stored, true)).toBe('light');
  });
});

describe('resolveThemeFromStorage — system preference fallback', () => {
  it('follows OS dark preference when theme is "system"', () => {
    const stored = JSON.stringify({ state: { theme: 'system' } });
    expect(resolveThemeFromStorage(stored, true)).toBe('dark');
  });

  it('follows OS light preference when theme is "system"', () => {
    const stored = JSON.stringify({ state: { theme: 'system' } });
    expect(resolveThemeFromStorage(stored, false)).toBe('light');
  });

  it('follows OS dark preference when no localStorage entry exists', () => {
    expect(resolveThemeFromStorage(null, true)).toBe('dark');
  });

  it('follows OS light preference when no localStorage entry exists', () => {
    expect(resolveThemeFromStorage(null, false)).toBe('light');
  });
});

describe('resolveThemeFromStorage — resilience', () => {
  it('falls back to OS preference when localStorage JSON is corrupt', () => {
    expect(resolveThemeFromStorage('not-valid-json{{{', true)).toBe('dark');
    expect(resolveThemeFromStorage('not-valid-json{{{', false)).toBe('light');
  });

  it('falls back to OS preference when state key is missing', () => {
    const stored = JSON.stringify({ version: 0 }); // no .state
    expect(resolveThemeFromStorage(stored, true)).toBe('dark');
  });

  it('falls back to OS preference when theme key is missing', () => {
    const stored = JSON.stringify({ state: { sidebarCollapsed: false } });
    expect(resolveThemeFromStorage(stored, false)).toBe('light');
  });

  it('falls back to OS preference for an unknown theme value', () => {
    const stored = JSON.stringify({ state: { theme: 'sepia' } });
    expect(resolveThemeFromStorage(stored, true)).toBe('dark');
  });
});
