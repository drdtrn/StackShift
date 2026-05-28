import { z } from 'zod';

// ---------------------------------------------------------------------------
// projectFormSchema
//
// Validates the 2-step "New Project" wizard.
//   Step 1: name, description
//   Step 2: read-only review, no additional fields
//
// The schema is the single source of truth for the form on the client and
// the POST /api/projects route on the server.
// ---------------------------------------------------------------------------

export const projectFormSchema = z.object({
  name: z
    .string()
    .min(3, 'Name must be at least 3 characters')
    .max(50, 'Name must be at most 50 characters'),
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .optional(),
});

export type ProjectFormInput = z.infer<typeof projectFormSchema>;
