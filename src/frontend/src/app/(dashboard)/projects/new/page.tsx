import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { Spinner } from '@/app/components/ui/Spinner';

export const metadata: Metadata = { title: 'New Project | StackSift' };

// NewProjectWizard pulls in the multi-step form and log-source selector — code-split
// so this chunk only loads when the user navigates to /projects/new.
const NewProjectWizard = dynamic(
  () => import('./_components/NewProjectWizard').then((m) => m.NewProjectWizard),
  { loading: () => <Spinner size="lg" />, ssr: false },
);

export default function NewProjectPage() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">New Project</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Connect a service to start ingesting logs.
        </p>
      </div>
      <NewProjectWizard />
    </div>
  );
}
