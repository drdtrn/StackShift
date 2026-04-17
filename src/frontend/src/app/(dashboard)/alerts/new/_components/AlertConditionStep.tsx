'use client';

import type { UseFormReturn } from 'react-hook-form';
import type { AlertRuleFormInput, AlertConditionType } from '@/app/lib/schemas/alert-rule';
import {
  ALERT_CONDITION_TYPES,
  ALERT_CONDITION_LABELS,
  CONDITION_DEFAULTS,
  LOG_LEVEL_OPTIONS,
} from '@/app/lib/schemas/alert-rule';
import { Input } from '@/app/components/ui/Input';
import { cn } from '@/app/lib/utils';

// ---------------------------------------------------------------------------
// AlertConditionStep — Step 2
//
// The user picks a condition type, then fills in the fields specific to that
// type. When the type changes, the entire condition object is reset to default
// values for the new type (same pattern as ProjectLogSourceStep).
//
// Dynamic field rendering — why conditional JSX instead of a single generic
// form?
//   Each condition type has a semantically different meaning for "threshold":
//     - ErrorRate: percentage (0–100%)
//     - LogVolume: count (min 1)
//     - Latency: milliseconds (min 1) + percentile
//     - PatternMatch: regex string + optional log level
//   A single generic set of inputs would need to know which label, unit, and
//   range applies for the active type. That logic scattered across label props
//   is worse than four explicit branches — the branches are self-documenting
//   and type-narrowed.
//
// Accessing sub-field errors:
//   errors.condition?.threshold works when TypeScript knows the active variant.
//   Because the condition field is a discriminated union at the type level,
//   TypeScript doesn't let us access .threshold directly on the union — we
//   cast to a flat error shape for rendering.
// ---------------------------------------------------------------------------

interface Props {
  form: UseFormReturn<AlertRuleFormInput>;
}

const CONDITION_DESCRIPTIONS: Record<AlertConditionType, string> = {
  ErrorRate: 'Fire when the error rate exceeds a percentage threshold',
  LogVolume: 'Fire when log count exceeds a volume threshold',
  PatternMatch: 'Fire when a specific regex pattern appears in logs',
  Latency: 'Fire when response latency exceeds a percentile threshold',
};

export function AlertConditionStep({ form }: Props) {
  const { register, watch, setValue, formState: { errors } } = form;

  const condition = watch('condition');
  const conditionType = condition.type;

  const handleTypeSelect = (type: AlertConditionType) => {
    if (type === conditionType) return;
    setValue('condition', CONDITION_DEFAULTS[type], {
      shouldValidate: false,
      shouldDirty: true,
    });
  };

  // Cast condition errors to a flat map for sub-field error access.
  // TypeScript can't narrow discriminated union errors directly in JSX.
  const condErrors = (errors.condition as Record<string, { message?: string }> | undefined) ?? {};

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Condition
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Define what triggers this alert rule.
        </p>
      </div>

      {/* ── Condition type selector ──────────────────────────────────── */}
      <fieldset>
        <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
          Condition type
        </legend>
        <div className="grid grid-cols-2 gap-3">
          {ALERT_CONDITION_TYPES.map((type) => {
            const isSelected = type === conditionType;
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
                <span
                  className={cn(
                    'text-sm font-semibold',
                    isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-zinc-900 dark:text-zinc-100',
                  )}
                >
                  {ALERT_CONDITION_LABELS[type]}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 leading-tight">
                  {CONDITION_DESCRIPTIONS[type]}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* ── Type-specific fields ─────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        {(conditionType === 'ErrorRate' || conditionType === 'LogVolume') && (
          <>
            <Input
              label={conditionType === 'ErrorRate' ? 'Threshold (%)' : 'Threshold (count)'}
              type="number"
              placeholder={conditionType === 'ErrorRate' ? 'e.g. 5' : 'e.g. 100'}
              helperText={
                conditionType === 'ErrorRate'
                  ? 'Alert fires when error rate exceeds this percentage.'
                  : 'Alert fires when log count exceeds this number in the window.'
              }
              errorMessage={condErrors.threshold?.message}
              {...register('condition.threshold' as 'condition')}
            />
            <Input
              label="Time window (minutes)"
              type="number"
              placeholder="e.g. 15"
              helperText="Evaluation window: 1–1440 minutes (max 24 hours)."
              errorMessage={condErrors.windowMinutes?.message}
              {...register('condition.windowMinutes' as 'condition')}
            />
          </>
        )}

        {conditionType === 'PatternMatch' && (
          <>
            <Input
              label="Regex pattern"
              placeholder='e.g. ERROR.*database|timeout'
              helperText="Regular expression matched against each log message."
              errorMessage={condErrors.pattern?.message}
              {...register('condition.pattern' as 'condition')}
            />

            {/* Log level filter — native select, optional */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="log-level-select"
                className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Log level filter{' '}
                <span className="font-normal text-zinc-400">(optional)</span>
              </label>
              <select
                id="log-level-select"
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                {...register('condition.logLevel' as 'condition')}
              >
                <option value="">Any level</option>
                {LOG_LEVEL_OPTIONS.map((level) => (
                  <option key={level} value={level}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Restrict pattern matching to a specific log level.
              </p>
            </div>
          </>
        )}

        {conditionType === 'Latency' && (
          <>
            <Input
              label="Threshold (ms)"
              type="number"
              placeholder="e.g. 500"
              helperText="Alert fires when latency at the chosen percentile exceeds this value."
              errorMessage={condErrors.thresholdMs?.message}
              {...register('condition.thresholdMs' as 'condition')}
            />
            <Input
              label="Percentile"
              type="number"
              placeholder="e.g. 95"
              helperText="Percentile to measure: 50 (median) – 99.99 (p99.99)."
              errorMessage={condErrors.percentile?.message}
              {...register('condition.percentile' as 'condition')}
            />
          </>
        )}
      </div>
    </div>
  );
}
