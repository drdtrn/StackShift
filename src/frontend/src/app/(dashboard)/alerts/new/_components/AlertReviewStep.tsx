'use client';

import type { UseFormReturn } from 'react-hook-form';
import type { AlertRuleFormInput, AlertCondition } from '@/app/lib/schemas/alert-rule';
import { useProjects } from '@/app/hooks/queries';

// ---------------------------------------------------------------------------
// AlertReviewStep — Step 3
//
// Read-only summary. The key requirement from AC7 is a human-readable
// sentence for the condition — not just the raw enum value.
// "Error rate > 5% in 15-minute window" is far more scannable than
// { type: 'ErrorRate', threshold: 5, windowMinutes: 15 }.
//
// getConditionSummary() handles this translation by switching on the type
// discriminant. TypeScript narrows the union inside each case, so we get
// type-safe access to case-specific fields (e.g. .threshold, .pattern).
// ---------------------------------------------------------------------------

interface Props {
  form: UseFormReturn<AlertRuleFormInput>;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        {label}
      </span>
      <span className="text-sm text-zinc-900 dark:text-zinc-100">{value}</span>
    </div>
  );
}

function getConditionSummary(condition: AlertCondition): string {
  switch (condition.type) {
    case 'ErrorRate':
      return `Error rate > ${condition.threshold}% in a ${condition.windowMinutes}-minute window`;
    case 'LogVolume':
      return `Log volume > ${condition.threshold} events in a ${condition.windowMinutes}-minute window`;
    case 'PatternMatch':
      return condition.logLevel
        ? `Pattern "${condition.pattern}" matched in ${condition.logLevel} logs`
        : `Pattern "${condition.pattern}" matched in any log`;
    case 'Latency':
      return `p${condition.percentile} latency > ${condition.thresholdMs} ms`;
  }
}

export function AlertReviewStep({ form }: Props) {
  const values = form.getValues();
  const { data: projects } = useProjects();
  const selectedProject = projects?.find((p) => p.id === values.projectId);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Review & create
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Confirm the rule details, then click{' '}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            Create Rule
          </span>
          .
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 dark:border-zinc-800 dark:bg-zinc-900/50">
        <Row label="Rule name" value={values.name} />
        <Row
          label="Project"
          value={selectedProject?.name ?? values.projectId}
        />
        <Row
          label="Condition"
          value={getConditionSummary(values.condition)}
        />
      </div>
    </div>
  );
}
