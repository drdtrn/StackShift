'use client';

import type { UseFormReturn } from 'react-hook-form';
import type { ProjectFormInput, LogSourceFormType } from '@/app/lib/schemas/project';
import { LOG_SOURCE_TYPES, LOG_SOURCE_DEFAULTS } from '@/app/lib/schemas/project';
import { Input } from '@/app/components/ui/Input';
import { cn } from '@/app/lib/utils';

// ---------------------------------------------------------------------------
// ProjectLogSourceStep — Step 2
//
// The user first picks a log source type via a radio-card group, then fills
// in the type-specific fields that appear below.
//
// WHY watch() + setValue() instead of a controlled <select>?
//   When the type changes, we replace the *entire* logSourceConfig object —
//   not just its .type property. This is required by the discriminated union:
//   the shape of the object must match one of the union variants exactly.
//   Calling setValue('logSourceConfig', LOG_SOURCE_DEFAULTS[newType]) does
//   two things at once:
//     1. Changes the type discriminant so Zod picks the right sub-schema.
//     2. Resets all sub-fields to empty defaults, clearing stale values from
//        the previously selected type (e.g. an endpoint URL should not carry
//        over into the file path field).
//   shouldValidate: false prevents premature error display before the user
//   has a chance to fill in the new fields.
//
// The conditional JSX below renders only the fields relevant to the active
// type. Because each branch accesses logSourceConfig.<type-specific-field>,
// TypeScript would complain about accessing .endpoint on an object that might
// be type 'Infrastructure'. We cast to `any` only inside the dynamic branches
// where the type is already narrowed by the watch() result — this is safe.
// ---------------------------------------------------------------------------

interface Props {
  form: UseFormReturn<ProjectFormInput>;
}

const TYPE_META: Record<LogSourceFormType, { label: string; description: string; icon: string }> = {
  Application: {
    label: 'Application',
    description: 'HTTP endpoint — send logs via SDK or HTTP POST',
    icon: '⬡',
  },
  Infrastructure: {
    label: 'Infrastructure',
    description: 'File tail — watch a log file on disk',
    icon: '⬢',
  },
  Security: {
    label: 'Security',
    description: 'SIEM integration — forward events from your security platform',
    icon: '⬟',
  },
  Custom: {
    label: 'Custom',
    description: 'Custom — describe your own ingestion method',
    icon: '⬠',
  },
};

export function ProjectLogSourceStep({ form }: Props) {
  const { register, watch, setValue, formState: { errors } } = form;

  // watch() subscribes the component to changes of this field. React re-renders
  // whenever logSourceConfig changes — this drives the conditional field rendering.
  const logSourceConfig = watch('logSourceConfig');
  const selectedType = logSourceConfig.type;

  const handleTypeSelect = (type: LogSourceFormType) => {
    if (type === selectedType) return;
    // Replace the whole object — this resets sub-fields and aligns the shape
    // with the chosen discriminated union variant.
    setValue('logSourceConfig', LOG_SOURCE_DEFAULTS[type], {
      shouldValidate: false,
      shouldDirty: true,
    });
  };

  // The logSourceConfig errors object structure changes based on the active
  // discriminant variant. We cast to Record<string, {message?: string}> to
  // access sub-field errors without exhaustive narrowing in the JSX below.
  const configErrors = (errors.logSourceConfig as Record<string, { message?: string }> | undefined) ?? {};

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Log source
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Choose how your service will send logs to StackSift.
        </p>
      </div>

      {/* ── Type selector — radio card group ──────────────────────────── */}
      <fieldset>
        <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
          Source type
        </legend>
        <div className="grid grid-cols-2 gap-3">
          {LOG_SOURCE_TYPES.map((type) => {
            const meta = TYPE_META[type];
            const isSelected = type === selectedType;
            return (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => handleTypeSelect(type)}
                className={cn(
                  'flex flex-col gap-1 rounded-lg border p-4 text-left transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                  isSelected
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/30'
                    : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700',
                )}
              >
                <span className="text-base">{meta.icon}</span>
                <span
                  className={cn(
                    'text-sm font-medium',
                    isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-zinc-900 dark:text-zinc-100',
                  )}
                >
                  {meta.label}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 leading-tight">
                  {meta.description}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* ── Type-specific fields ───────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        {selectedType === 'Application' && (
          <Input
            label="Ingest endpoint URL"
            placeholder="https://api.example.com/logs"
            helperText="The URL your application will POST log events to."
            errorMessage={configErrors.endpoint?.message}
            {...register('logSourceConfig.endpoint' as 'logSourceConfig')}
          />
        )}

        {selectedType === 'Infrastructure' && (
          <Input
            label="Log file path"
            placeholder="/var/log/app/server.log"
            helperText="Absolute path on the host where the log agent will tail the file."
            errorMessage={configErrors.filePath?.message}
            {...register('logSourceConfig.filePath' as 'logSourceConfig')}
          />
        )}

        {selectedType === 'Security' && (
          <Input
            label="SIEM integration name"
            placeholder="e.g. Splunk, QRadar, Microsoft Sentinel"
            helperText="Name of the SIEM platform forwarding events to StackSift."
            errorMessage={configErrors.siemIntegration?.message}
            {...register('logSourceConfig.siemIntegration' as 'logSourceConfig')}
          />
        )}

        {selectedType === 'Custom' && (
          <Input
            label="Integration description"
            placeholder="Describe how logs will be ingested"
            helperText="Brief explanation of your custom log ingestion method."
            errorMessage={configErrors.customDescription?.message}
            {...register('logSourceConfig.customDescription' as 'logSourceConfig')}
          />
        )}
      </div>
    </div>
  );
}
