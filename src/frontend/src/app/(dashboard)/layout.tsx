import type { Metadata } from 'next';
import { AuthGuard } from '@/app/components/providers/AuthGuard';
import { OnboardingGuard } from '@/app/components/providers/OnboardingGuard';
import { AppShell } from '@/app/components/layout/AppShell';

export const metadata: Metadata = {
  title: {
    default: 'Dashboard — StackSift',
    template: '%s — StackSift',
  },
};

/**
 * Dashboard group layout — persistent navigation shell.
 *
 * This is a Server Component (needed for `metadata` export).
 * All interactive chrome (collapsible sidebar, mobile drawer, hamburger) is
 * delegated to <AppShell> which is the single 'use client' boundary.
 *
 * Guard order:
 *   AuthGuard     — redirects to /login if no session cookie
 *   OnboardingGuard — redirects to /onboarding if user has no organisation
 *   AppShell      — renders the full responsive navigation shell
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <OnboardingGuard>
        <AppShell>{children}</AppShell>
      </OnboardingGuard>
    </AuthGuard>
  );
}
