import type { Metadata } from 'next';
import { AlertRuleBuilderLoader } from './_components/AlertRuleBuilderLoader';

export const metadata: Metadata = { title: 'New Alert Rule | StackSift' };

export default function NewAlertPage() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">New Alert Rule</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Configure when StackSift should fire an alert.
        </p>
      </div>
      <AlertRuleBuilderLoader />
    </div>
  );
}
