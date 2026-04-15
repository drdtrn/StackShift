import { z } from 'zod';

// ---------------------------------------------------------------------------
// alertRuleFormSchema
//
// Validates the 3-step "New Alert Rule" builder (US-08).
//
// Step 1 fields: name, projectId
// Step 2 fields: condition (discriminated union — different sub-fields
//               depending on which condition type the user selects)
// Step 3:       read-only review, no additional fields
//
// WHY z.enum() not z.nativeEnum(LogLevel)?
//   domain.ts defines LogLevel as a TypeScript union type:
//     export type LogLevel = 'trace' | 'debug' | 'info' | ...
//   z.nativeEnum() expects a TypeScript `enum` (the const-object kind) — it
//   will not work with a union alias. z.enum([...]) is the correct Zod
//   primitive for a fixed set of string literals.
//
// WHY z.coerce.number() for numeric fields?
//   HTML <input type="number"> always delivers a string to the DOM event.
//   RHF passes that string to Zod. z.coerce.number() converts "5" → 5 before
//   the min/max checks fire. Without coerce, every number field would always
//   fail validation even when the input looks correct.
// ---------------------------------------------------------------------------

export const ALERT_CONDITION_TYPES = ['ErrorRate', 'LogVolume', 'PatternMatch', 'Latency'] as const;
export type AlertConditionType = (typeof ALERT_CONDITION_TYPES)[number];

// Human-readable labels shown in the condition type selector.
export const ALERT_CONDITION_LABELS: Record<AlertConditionType, string> = {
  ErrorRate: 'Error Rate',
  LogVolume: 'Log Volume',
  PatternMatch: 'Pattern Match',
  Latency: 'Latency',
};

// Default values when the user switches condition type — resets the sub-fields
// to sensible starting values so they don't see stale data from the old type.
export const CONDITION_DEFAULTS = {
  ErrorRate: { type: 'ErrorRate' as const, threshold: 5, windowMinutes: 15 },
  LogVolume: { type: 'LogVolume' as const, threshold: 100, windowMinutes: 60 },
  PatternMatch: { type: 'PatternMatch' as const, pattern: '', logLevel: undefined },
  Latency: { type: 'Latency' as const, thresholdMs: 500, percentile: 95 },
} as const satisfies Record<AlertConditionType, { type: AlertConditionType; [k: string]: unknown }>;

// Log levels for the PatternMatch filter dropdown.
export const LOG_LEVEL_OPTIONS = ['trace', 'debug', 'info', 'warning', 'error', 'critical'] as const;

const conditionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ErrorRate'),
    // coerce: HTML input returns a string; coerce converts "5" → 5 before min/max
    threshold: z.coerce
      .number({ invalid_type_error: 'Must be a number' })
      .min(0, 'Must be ≥ 0%')
      .max(100, 'Must be ≤ 100%'),
    windowMinutes: z.coerce
      .number({ invalid_type_error: 'Must be a number' })
      .min(1, 'Minimum 1 minute')
      .max(1440, 'Maximum 1440 minutes (24 h)'),
  }),
  z.object({
    type: z.literal('LogVolume'),
    threshold: z.coerce
      .number({ invalid_type_error: 'Must be a number' })
      .min(1, 'Must be at least 1'),
    windowMinutes: z.coerce
      .number({ invalid_type_error: 'Must be a number' })
      .min(1, 'Minimum 1 minute')
      .max(1440, 'Maximum 1440 minutes (24 h)'),
  }),
  z.object({
    type: z.literal('PatternMatch'),
    pattern: z.string().min(1, 'Pattern is required'),
    // Optional field — user may leave this unset to match any log level.
    logLevel: z.enum(LOG_LEVEL_OPTIONS).optional(),
  }),
  z.object({
    type: z.literal('Latency'),
    thresholdMs: z.coerce
      .number({ invalid_type_error: 'Must be a number' })
      .min(1, 'Must be at least 1 ms'),
    percentile: z.coerce
      .number({ invalid_type_error: 'Must be a number' })
      .min(50, 'Must be ≥ p50')
      .max(99.99, 'Must be ≤ p99.99'),
  }),
]);

export const alertRuleFormSchema = z.object({
  name: z
    .string()
    .min(3, 'Name must be at least 3 characters')
    .max(100, 'Name must be at most 100 characters'),
  // projectId is a UUID selected from a dropdown — we validate non-empty
  // instead of strict UUID format so mock IDs always pass.
  projectId: z.string().min(1, 'Project is required'),
  condition: conditionSchema,
});

export type AlertRuleFormInput = z.infer<typeof alertRuleFormSchema>;
export type AlertCondition = z.infer<typeof conditionSchema>;
