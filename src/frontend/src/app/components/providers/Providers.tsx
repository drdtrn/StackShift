'use client';

import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { createQueryClientWithErrorHandler } from '@/app/lib/query-client';
import { useThemeEffect } from '@/app/hooks/useThemeEffect';

// ---------------------------------------------------------------------------
// Providers — client-side context wrapper for the entire app.
//
// WHY a ref for QueryClient?
//   React can re-render this component (e.g., on hot reload or state change).
//   If we wrote `const queryClient = createQueryClientWithErrorHandler()` at
//   the top of the function body, we'd create a brand-new client on every
//   render — losing the entire cache. A ref creates the instance once and
//   holds it stable across re-renders, matching the App Router docs pattern.
//
// WHY ReactQueryDevtools only in development?
//   The component tree-shakes in production builds, but wrapping it in the
//   NODE_ENV check makes the intent explicit and avoids any dev-only UI
//   leaking through accidental production env misconfiguration.
//
// WHY this file is 'use client'?
//   QueryClientProvider uses React Context internally. Context providers
//   cannot run in Server Components. This file is the ONLY file that needs
//   the 'use client' directive for provider purposes — root layout.tsx stays
//   a pure Server Component.
// ---------------------------------------------------------------------------

export function Providers({ children }: { children: React.ReactNode }) {
// WHY useState with lazy initializer (not useRef)?
  //   `useRef` accessed during render is flagged by the React Compiler's
  //   `react-hooks/refs` lint rule. `useState` with a lazy initializer
  //   (`() => createQueryClientWithErrorHandler()`) creates the QueryClient
  //   exactly once on mount and holds it stable across re-renders — identical
  //   behaviour to a ref, without the lint violation.
  const [queryClient] = useState(() => createQueryClientWithErrorHandler());

  // Apply theme class to <html> based on persisted user preference.
  useThemeEffect();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
      )}
    </QueryClientProvider>
  );
}
