'use client';

import dynamic from 'next/dynamic';
import { Spinner } from '@/app/components/ui/Spinner';

// A dependency of NewProjectWizard uses CJS require() which Turbopack does not
// support during SSR. ssr: false must live in a Client Component because
// Next.js 16 disallows it in Server Components.
const NewProjectWizard = dynamic(
  () => import('./NewProjectWizard').then((m) => m.NewProjectWizard),
  { loading: () => <Spinner size="lg" />, ssr: false },
);

export function NewProjectWizardLoader() {
  return <NewProjectWizard />;
}
