'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Sidebar } from './Sidebar';

// ---------------------------------------------------------------------------
// MobileDrawer
//
// A full-height overlay drawer shown on mobile viewports when the hamburger
// button in MobileTopBar is clicked.
//
// Structure:
//   - AnimatePresence: enables exit animations when `open` becomes false
//   - Backdrop (motion.div): semi-transparent overlay; click closes drawer
//   - motion.aside: slides in from the left, contains a full-width Sidebar
//     plus a close button in the top-right corner
//
// Framer Motion strategy:
//   - Backdrop: opacity 0 → 1 on mount, 1 → 0 on exit (fast, 150ms)
//   - Drawer: x: -256 → 0 on mount, 0 → -256 on exit (200ms ease-out)
//   - This matches the Modal component's AnimatePresence pattern (FE-04)
//
// Accessibility:
//   - Drawer is role="dialog" with aria-modal="true"
//   - Close button has explicit aria-label
//   - Clicking any nav link calls onClose so the drawer closes after navigation
// ---------------------------------------------------------------------------

export interface MobileDrawerProps {
  /** Whether the drawer is currently open. */
  open: boolean;
  /** Called when the user closes the drawer (backdrop, close button, or nav link). */
  onClose: () => void;
}

export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="mobile-drawer-backdrop"
            data-testid="mobile-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            aria-hidden="true"
            onClick={onClose}
          />

          {/* Drawer panel */}
          <motion.aside
            key="mobile-drawer-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            initial={{ x: -256 }}
            animate={{ x: 0 }}
            exit={{ x: -256 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-y-0 left-0 z-50 w-64 md:hidden"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation menu"
              className="absolute right-3 top-3 z-10 rounded-md p-1 text-muted transition-colors hover:bg-elevated hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>

            <Sidebar
              collapsed={false}
              onToggle={() => {/* no-op — no collapse in mobile drawer */}}
              isMobile={true}
              onNavClick={onClose}
            />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
