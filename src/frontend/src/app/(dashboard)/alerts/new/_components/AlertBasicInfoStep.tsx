'use client';

import type { UseFormReturn } from 'react-hook-form';
import type { AlertRuleFormInput } from '@/app/lib/schemas/alert-rule';
import { useProjects } from '@/app/hooks/queries';
import { Input } from '@/app/components/ui/Input';
import { Spinner } from '@/app/components/ui/Spinner';

// ---------------------------------------------------------------------------
// AlertBasicInfoStep — Step 1
//
// Fields: rule name, project (select)
//
// WHY a native <select> instead of the Dropdown component?
//   The Dropdown component is a custom button-triggered popover — it requires
//   explicit option selection handling. A native <select> can be registered
//   directly with RHF's register() and works identically with keyboard nav,
//   screen readers, and mobile select pickers out of the box. We reach for
//   the custom Dropdown when we need multi-select or rich option content;
//   for a simple single-value pick, native is simpler and more accessible.
//
// The project list loads asynchronously via useProjects(). While loading, we
// show a spinner and disable the select. This prevents submission with an
// empty projectId while data is still in flight.
// ---------------------------------------------------------------------------

interface Props {
  form: UseFormReturn<AlertRuleFormInput>;
}

export function AlertBasicInfoStep({ form }: Props) {
  const {
    register,
    formState: { errors },
  } = form;

  const { data: projects, isLoading: projectsLoading } = useProjects();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Basic information
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Name this rule and choose which project it monitors.
        </p>
      </div>

      <Input
        label="Rule name"
        placeholder="e.g. High error rate on API Gateway"
        helperText="3–100 characters."
        errorMessage={errors.name?.message}
        autoFocus
        aria-required="true"
        {...register('name')}
      />

      {/* Project select */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="project-select"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Project
        </label>

        {projectsLoading ? (
          <div className="flex items-center gap-2 h-9 text-sm text-zinc-500">
            <Spinner size="sm" />
            <span>Loading projects…</span>
          </div>
        ) : (
          <select
            id="project-select"
            aria-required="true"
            aria-invalid={errors.projectId ? true : undefined}
            aria-describedby={errors.projectId ? 'project-error' : undefined}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 aria-invalid:border-red-500 aria-invalid:focus:ring-red-500 dark:aria-invalid:border-red-600"
            {...register('projectId')}
          >
            <option value="">Select a project…</option>
            {projects?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}

        {errors.projectId && (
          <p id="project-error" role="alert" className="text-xs text-red-600 dark:text-red-400">
            {errors.projectId.message}
          </p>
        )}
      </div>
    </div>
  );
}
