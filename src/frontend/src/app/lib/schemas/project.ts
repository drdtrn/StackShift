import { z } from 'zod';

// ---------------------------------------------------------------------------
// projectFormSchema
//
// Validates the 3-step "New Project" wizard (US-08).
//
// Step 1 fields: name, description
// Step 2 fields: logSourceConfig (discriminated union — different sub-fields
//               depending on which log source type the user selects)
// Step 3:       read-only review, no additional fields
//
// WHY z.discriminatedUnion?
//   Each log source type needs different configuration fields. Rather than a
//   flat schema full of optional fields ("endpoint?: string, filePath?: string")
//   where any combination is technically valid, a discriminated union says:
//   "if type === 'Application', then endpoint is required; if type ===
//   'Infrastructure', then filePath is required — and nothing else."
//   Zod inspects the 'type' literal first (the discriminant), picks the right
//   sub-schema, and validates only the relevant fields.
//
// WHY z.coerce.number()?
//   HTML <input type="number"> still returns a string from the DOM. z.number()
//   alone would always fail on a string "5". z.coerce.number() converts the
//   string to a number before validating — this is the standard RHF + Zod
//   pattern for numeric inputs.
//
// The schema is exported and imported by BOTH:
//   - NewProjectWizard (client) via zodResolver
//   - POST /api/projects (server) via safeParse
// This single-source-of-truth approach means the validation rules can never
// diverge between client and server.
// ---------------------------------------------------------------------------

// These are form-specific type labels (distinct from domain.ts LogSourceType
// which represents stored entities). The form uses human-friendly PascalCase
// names; the API route maps these to the stored format.
export const LOG_SOURCE_TYPES = ['Application', 'Infrastructure', 'Security', 'Custom'] as const;
export type LogSourceFormType = (typeof LOG_SOURCE_TYPES)[number];

// Default config shapes per type — used when the user switches source type to
// reset the sub-fields to empty/sensible defaults.
export const LOG_SOURCE_DEFAULTS = {
  Application: { type: 'Application' as const, endpoint: '' },
  Infrastructure: { type: 'Infrastructure' as const, filePath: '' },
  Security: { type: 'Security' as const, siemIntegration: '' },
  Custom: { type: 'Custom' as const, customDescription: '' },
} as const satisfies Record<LogSourceFormType, { type: LogSourceFormType; [k: string]: unknown }>;

const logSourceConfigSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('Application'),
    endpoint: z.string().url('Must be a valid URL (e.g. https://api.example.com/logs)'),
  }),
  z.object({
    type: z.literal('Infrastructure'),
    filePath: z.string().min(1, 'File path is required'),
  }),
  z.object({
    type: z.literal('Security'),
    siemIntegration: z.string().min(1, 'SIEM integration name is required'),
  }),
  z.object({
    type: z.literal('Custom'),
    customDescription: z.string().min(1, 'Description is required'),
  }),
]);

export const projectFormSchema = z.object({
  name: z
    .string()
    .min(3, 'Name must be at least 3 characters')
    .max(50, 'Name must be at most 50 characters'),
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .optional(),
  logSourceConfig: logSourceConfigSchema,
});

export type ProjectFormInput = z.infer<typeof projectFormSchema>;

// Type-narrowing helpers used in review/summary rendering. TypeScript doesn't
// know which variant is active after the discriminated union is inferred —
// these guards let step components narrow safely.
export type LogSourceConfig = z.infer<typeof logSourceConfigSchema>;
