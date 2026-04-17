import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Theme = 'light' | 'dark' | 'system';

interface UIStore {
  // --- Sidebar state -------------------------------------------------------
  /** Whether the desktop sidebar is collapsed to icon-only width (w-16 vs w-56). */
  sidebarCollapsed: boolean;
  /** Whether the mobile slide-in drawer is open. */
  mobileDrawerOpen: boolean;

  // --- Context state -------------------------------------------------------
  /**
   * The ID of the currently selected project context.
   * Null means "all projects" (global view).
   * Persisted so the user lands on their last project after reload.
   */
  activeProjectId: string | null;

  // --- Appearance ----------------------------------------------------------
  /**
   * The user's theme preference.
   * 'system' reads the OS prefers-color-scheme media query.
   * Persisted to localStorage via Zustand persist middleware.
   */
  theme: Theme;

  // --- Actions -------------------------------------------------------------
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleMobileDrawer: () => void;
  setMobileDrawerOpen: (open: boolean) => void;
  setActiveProject: (projectId: string | null) => void;
  setTheme: (theme: Theme) => void;
}

// ---------------------------------------------------------------------------
// Store
//
// Uses two middleware layers:
//   1. `devtools` — Redux DevTools integration with named actions.
//   2. `persist` — writes `theme` and `activeProjectId` to localStorage so
//      user preferences survive page reloads. `sidebarCollapsed` is also
//      persisted (common UX pattern — remember collapsed state).
//
// Middleware order matters in Zustand v5:
//   create<T>()(devtools(persist(...)))
//   The outermost middleware (devtools) sees the full store including
//   persistence metadata, giving accurate DevTools snapshots.
// ---------------------------------------------------------------------------

export const useUIStore = create<UIStore>()(
  devtools(
    persist(
      (set) => ({
        sidebarCollapsed: false,
        mobileDrawerOpen: false,
        activeProjectId: null,
        theme: 'system',

        toggleSidebar: () =>
          set(
            (state) => ({ sidebarCollapsed: !state.sidebarCollapsed }),
            false,
            'toggleSidebar',
          ),

        setSidebarCollapsed: (collapsed) =>
          set(
            () => ({ sidebarCollapsed: collapsed }),
            false,
            'setSidebarCollapsed',
          ),

        toggleMobileDrawer: () =>
          set(
            (state) => ({ mobileDrawerOpen: !state.mobileDrawerOpen }),
            false,
            'toggleMobileDrawer',
          ),

        setMobileDrawerOpen: (open) =>
          set(
            () => ({ mobileDrawerOpen: open }),
            false,
            'setMobileDrawerOpen',
          ),

        setActiveProject: (projectId) =>
          set(
            () => ({ activeProjectId: projectId }),
            false,
            'setActiveProject',
          ),

        setTheme: (theme) =>
          set(
            () => ({ theme }),
            false,
            'setTheme',
          ),
      }),
      {
        name: 'stacksift-ui-preferences',
        // Only persist the fields that make sense across reloads.
        // mobileDrawerOpen should always start closed.
        partialize: (state) => ({
          sidebarCollapsed: state.sidebarCollapsed,
          activeProjectId: state.activeProjectId,
          theme: state.theme,
        }),
      },
    ),
    { name: 'UIStore' },
  ),
);
