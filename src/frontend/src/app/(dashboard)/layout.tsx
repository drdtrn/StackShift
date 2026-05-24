import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthGuard } from '@/app/components/providers/AuthGuard';
import { OrgGuard } from '@/app/components/providers/OrgGuard';
import { SignalRProvider } from '@/app/components/providers/SignalRProvider';
import { AppShell } from '@/app/components/layout/AppShell';
import { getServerSessionUser } from '@/app/lib/auth/session';

export const metadata: Metadata = {
  title: {
    default: 'Dashboard — StackSift',
    template: '%s — StackSift',
  },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerSessionUser();
  if (!user) redirect('/landing');
  if (!user.organizationId) {
    redirect(user.role === 'owner' ? '/onboarding' : '/waiting');
  }

  return (
    <AuthGuard>
      <OrgGuard>
        <SignalRProvider>
          <AppShell>{children}</AppShell>
        </SignalRProvider>
      </OrgGuard>
    </AuthGuard>
  );
}
