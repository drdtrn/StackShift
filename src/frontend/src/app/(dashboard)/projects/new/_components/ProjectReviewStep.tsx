'use client';

import type { UseFormReturn } from 'react-hook-form';
import type { ProjectFormInput } from '@/app/lib/schemas/project';

// ---------------------------------------------------------------------------
// ProjectReviewStep — Step 3
//
// Read-only summary of all values before final submission. No register() calls
// here — we only read values via getValues().
//
// WHY a separate review step?
//   Multi-step forms accumulate data across disconnected steps. Without a
//   review, users often submit with typos from step 1 that they can no longer
//   see by step 3. The review step surfaces the full picture before commit.
//
// getValues() is used instead of watch() because we do NOT need to subscribe
// to further changes — the review step is static once rendered. watch() would
// add a subscriber that fires on every keystroke (unnecessary overhead).
// ---------------------------------------------------------------------------

interface Props {
  form: UseFormReturn<ProjectFormInput>;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        {label}
      </span>
      <span className="text-sm text-zinc-900 dark:text-zinc-100 break-all">
        {value}
      </span>
    </div>
  );
}

export function ProjectReviewStep({ form }: Props) {
  const values = form.getValues();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Review & create
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Confirm the details below, then click{' '}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            Create Project
          </span>{' '}
          to finish.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 dark:border-zinc-800 dark:bg-zinc-900/50">
        <Row label="Project name" value={values.name} />
        <Row
          label="Description"
          value={values.description || <span className="italic text-zinc-400">None</span>}
        />
      </div>
    </div>
  );
}
