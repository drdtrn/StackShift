/**
 * Tests for useThemeEffect (US-06)
 *
 * Verifies that the hook correctly applies CSS classes to document.documentElement
 * based on the theme stored in useUIStore.
 */

import { renderHook, act } from '@testing-library/react';
import { useThemeEffect } from '@/app/hooks/useThemeEffect';
import { useUIStore } from '@/app/hooks/useUIStore';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

// Mock matchMedia — jsdom doesn't implement it.
const mockAddEventListener = jest.fn();
const mockRemoveEventListener = jest.fn();

function setupMatchMedia(prefersDark: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: query.includes('dark') ? prefersDark : false,
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener,
    })),
  });
}

beforeEach(() => {
  // Clean slate for each test
  document.documentElement.className = '';
  useUIStore.setState({ theme: 'dark' });
  mockAddEventListener.mockClear();
  mockRemoveEventListener.mockClear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useThemeEffect — dark theme', () => {
  it('adds "dark" class and removes "light" when theme is dark', () => {
    useUIStore.setState({ theme: 'dark' });
    renderHook(() => useThemeEffect());
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('removes a pre-existing "light" class when switching to dark', () => {
    document.documentElement.classList.add('light');
    useUIStore.setState({ theme: 'dark' });
    renderHook(() => useThemeEffect());
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });
});

describe('useThemeEffect — light theme', () => {
  it('adds "light" class and removes "dark" when theme is light', () => {
    useUIStore.setState({ theme: 'light' });
    renderHook(() => useThemeEffect());
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});

describe('useThemeEffect — system theme', () => {
  it('applies dark when OS preference is dark', () => {
    setupMatchMedia(true);
    useUIStore.setState({ theme: 'system' });
    renderHook(() => useThemeEffect());
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('applies light when OS preference is light', () => {
    setupMatchMedia(false);
    useUIStore.setState({ theme: 'system' });
    renderHook(() => useThemeEffect());
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('attaches a change listener to matchMedia', () => {
    setupMatchMedia(false);
    useUIStore.setState({ theme: 'system' });
    renderHook(() => useThemeEffect());
    expect(mockAddEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('removes the change listener on cleanup', () => {
    setupMatchMedia(false);
    useUIStore.setState({ theme: 'system' });
    const { unmount } = renderHook(() => useThemeEffect());
    unmount();
    expect(mockRemoveEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});

describe('useThemeEffect — reactive to store changes', () => {
  it('re-applies classes when theme changes from dark to light', () => {
    useUIStore.setState({ theme: 'dark' });
    renderHook(() => useThemeEffect());
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    act(() => {
      useUIStore.getState().setTheme('light');
    });

    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
