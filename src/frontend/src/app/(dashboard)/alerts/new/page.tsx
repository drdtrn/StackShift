import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { Spinner } from '@/app/components/ui/Spinner';

export const metadata: Metadata = { title: 'New Alert Rule | StackSift' };

// AlertRuleBuilder pulls in react-hook-form, zod, and the FormStepper — code-split
// so this chunk only loads when the user navigates to /alerts/new.
const AlertRuleBuilder = dynamic(
  () => import('./_components/AlertRuleBuilder').then((m) => m.AlertRuleBuilder),
  { loading: () => <Spinner size="lg" /> },
);

export default function NewAlertPage() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">New Alert Rule</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Configure when StackSift should fire an alert.
        </p>
      </div>
      <AlertRuleBuilder />
    </div>
  );
}
