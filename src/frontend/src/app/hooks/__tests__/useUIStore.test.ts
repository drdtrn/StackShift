import { act, renderHook } from '@testing-library/react';
import { useUIStore } from '../useUIStore';

// Reset Zustand store between tests to avoid state leakage
beforeEach(() => {
  useUIStore.setState({
    sidebarCollapsed: false,
    mobileDrawerOpen: false,
    activeProjectId: null,
    theme: 'system',
  });
});

describe('useUIStore', () => {
  describe('initial state', () => {
    it('starts with sidebar expanded', () => {
      const { result } = renderHook(() => useUIStore());
      expect(result.current.sidebarCollapsed).toBe(false);
    });

    it('starts with mobile drawer closed', () => {
      const { result } = renderHook(() => useUIStore());
      expect(result.current.mobileDrawerOpen).toBe(false);
    });

    it('starts with no active project', () => {
      const { result } = renderHook(() => useUIStore());
      expect(result.current.activeProjectId).toBeNull();
    });

    it('starts with system theme', () => {
      const { result } = renderHook(() => useUIStore());
      expect(result.current.theme).toBe('system');
    });
  });

  describe('toggleSidebar', () => {
    it('collapses sidebar when expanded', () => {
      const { result } = renderHook(() => useUIStore());
      act(() => result.current.toggleSidebar());
      expect(result.current.sidebarCollapsed).toBe(true);
    });

    it('expands sidebar when collapsed', () => {
      const { result } = renderHook(() => useUIStore());
      act(() => {
        result.current.setSidebarCollapsed(true);
        result.current.toggleSidebar();
      });
      expect(result.current.sidebarCollapsed).toBe(false);
    });

    it('toggles correctly on repeated calls', () => {
      const { result } = renderHook(() => useUIStore());
      act(() => result.current.toggleSidebar());
      act(() => result.current.toggleSidebar());
      expect(result.current.sidebarCollapsed).toBe(false);
    });
  });

  describe('setSidebarCollapsed', () => {
    it('explicitly collapses sidebar', () => {
      const { result } = renderHook(() => useUIStore());
      act(() => result.current.setSidebarCollapsed(true));
      expect(result.current.sidebarCollapsed).toBe(true);
    });

    it('explicitly expands sidebar', () => {
      const { result } = renderHook(() => useUIStore());
      act(() => {
        result.current.setSidebarCollapsed(true);
        result.current.setSidebarCollapsed(false);
      });
      expect(result.current.sidebarCollapsed).toBe(false);
    });
  });

  describe('setTheme', () => {
    it('sets theme to dark', () => {
      const { result } = renderHook(() => useUIStore());
      act(() => result.current.setTheme('dark'));
      expect(result.current.theme).toBe('dark');
    });

    it('sets theme to light', () => {
      const { result } = renderHook(() => useUIStore());
      act(() => result.current.setTheme('light'));
      expect(result.current.theme).toBe('light');
    });

    it('sets theme back to system', () => {
      const { result } = renderHook(() => useUIStore());
      act(() => {
        result.current.setTheme('dark');
        result.current.setTheme('system');
      });
      expect(result.current.theme).toBe('system');
    });
  });

  describe('setActiveProject', () => {
    it('sets a project ID', () => {
      const { result } = renderHook(() => useUIStore());
      act(() => result.current.setActiveProject('project-abc'));
      expect(result.current.activeProjectId).toBe('project-abc');
    });

    it('clears active project when set to null', () => {
      const { result } = renderHook(() => useUIStore());
      act(() => {
        result.current.setActiveProject('project-abc');
        result.current.setActiveProject(null);
      });
      expect(result.current.activeProjectId).toBeNull();
    });
  });

  describe('toggleMobileDrawer', () => {
    it('opens mobile drawer when closed', () => {
      const { result } = renderHook(() => useUIStore());
      act(() => result.current.toggleMobileDrawer());
      expect(result.current.mobileDrawerOpen).toBe(true);
    });

    it('closes mobile drawer when open', () => {
      const { result } = renderHook(() => useUIStore());
      act(() => {
        result.current.setMobileDrawerOpen(true);
        result.current.toggleMobileDrawer();
      });
      expect(result.current.mobileDrawerOpen).toBe(false);
    });
  });

  describe('setMobileDrawerOpen', () => {
    it('explicitly opens mobile drawer', () => {
      const { result } = renderHook(() => useUIStore());
      act(() => result.current.setMobileDrawerOpen(true));
      expect(result.current.mobileDrawerOpen).toBe(true);
    });
  });
});
