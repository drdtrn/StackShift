import { z } from 'zod';

// ---------------------------------------------------------------------------
// createOrganisationSchema
//
// Validates the "Create Organisation" form (US-03) and the POST body of the
// /api/onboarding/create-org Route Handler. A single source of truth used
// by both React Hook Form (via zodResolver) and the server-side handler.
//
// Rules:
//   - name is required (non-empty string)
//   - 2–50 characters
//   - First character must be alphanumeric (prevents leading spaces/hyphens)
//   - Remaining characters: letters, digits, spaces, hyphens
//
// The regex intentionally allows spaces because organisations often have
// multi-word names (e.g. "Acme Corp", "Nexus Labs"). The server normalises
// spaces → hyphens when generating the slug.
// ---------------------------------------------------------------------------

export const createOrganisationSchema = z.object({
  name: z
    .string()
    .min(2, 'Organisation name must be at least 2 characters')
    .max(50, 'Organisation name must be at most 50 characters')
    .regex(
      /^[a-zA-Z0-9][a-zA-Z0-9 -]*$/,
      'Organisation name must start with a letter or number, and can only contain letters, numbers, spaces, and hyphens',
    ),
});

export type CreateOrganisationInput = z.infer<typeof createOrganisationSchema>;
