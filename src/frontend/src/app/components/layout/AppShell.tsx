'use client';

import { motion } from 'framer-motion';
import { useUIStore } from '@/app/hooks/useUIStore';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileDrawer } from './MobileDrawer';

// ---------------------------------------------------------------------------
// AppShell
//
// The 'use client' orchestrator for the entire dashboard chrome.
//
//   Desktop (≥ 768px):
//     ┌────────────────────────────────────────────────────────┐
//     │ [Sidebar w-56/w-16] │ [TopBar — full width of content] │
//     │                     ├──────────────────────────────────┤
//     │                     │ [main flex-1 children]           │
//     └────────────────────────────────────────────────────────┘
//
//   Mobile (< 768px):
//     ┌────────────────────────────────┐
//     │ [TopBar — ☰ hamburger + title] │
//     ├────────────────────────────────┤
//     │ [main flex-1 children]         │
//     └────────────────────────────────┘
//     The MobileDrawer overlays the content when the hamburger is clicked.
//
// Layout change from US-05:
//   The outer wrapper is now flex-row (sidebar beside content column).
//   The right side is a flex-col containing TopBar stacked above main.
//   MobileTopBar is removed — TopBar handles the hamburger via md:hidden.
//   min-w-0 on the right panel prevents long breadcrumbs from overflowing.
// ---------------------------------------------------------------------------

const SIDEBAR_EXPANDED_WIDTH = 224; // px — matches Tailwind w-56
const SIDEBAR_COLLAPSED_WIDTH = 64; // px — matches Tailwind w-16

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    sidebarCollapsed,
    mobileDrawerOpen,
    toggleSidebar,
    setMobileDrawerOpen,
  } = useUIStore();

  return (
    <div className="flex min-h-screen">
      {/* Mobile drawer overlay — sits above everything */}
      <MobileDrawer
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
      />

      {/* Desktop sidebar — hidden on mobile */}
      <motion.div
        className="hidden md:flex shrink-0 overflow-hidden"
        animate={{ width: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        style={{ minHeight: 0 }}
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
          isMobile={false}
        />
      </motion.div>

      {/* Right panel: TopBar above scrollable main content */}
      <div className="flex flex-1 flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
