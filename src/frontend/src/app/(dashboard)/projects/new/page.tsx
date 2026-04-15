import type { Metadata } from 'next';
import { NewProjectWizard } from './_components/NewProjectWizard';

export const metadata: Metadata = { title: 'New Project | StackSift' };

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
