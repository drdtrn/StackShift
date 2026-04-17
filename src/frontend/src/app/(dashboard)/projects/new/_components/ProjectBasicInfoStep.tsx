'use client';

import type { UseFormReturn } from 'react-hook-form';
import type { ProjectFormInput } from '@/app/lib/schemas/project';
import { Input } from '@/app/components/ui/Input';
import { Textarea } from '@/app/components/ui/Textarea';

// ---------------------------------------------------------------------------
// ProjectBasicInfoStep — Step 1
//
// Fields: name (required), description (optional)
//
// Receives the parent wizard's `form` object rather than individual callbacks.
// UseFormReturn<T> is the type returned by useForm<T>() — it carries register,
// formState, watch, setValue, and everything else RHF gives you. This pattern
// avoids threading six individual props down and is the standard approach when
// step components live close to the wizard.
// ---------------------------------------------------------------------------

interface Props {
  form: UseFormReturn<ProjectFormInput>;
}

export function ProjectBasicInfoStep({ form }: Props) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Basic information
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Give your project a name so you can identify its logs and alerts.
        </p>
      </div>

      <Input
        label="Project name"
        placeholder="e.g. API Gateway"
        helperText="3–50 characters."
        errorMessage={errors.name?.message}
        autoFocus
        aria-required="true"
        {...register('name')}
      />

      <Textarea
        label="Description"
        placeholder="Optional — briefly describe what this project monitors."
        helperText="Up to 500 characters."
        maxLength={500}
        errorMessage={errors.description?.message}
        rows={3}
        {...register('description')}
      />
    </div>
  );
}
