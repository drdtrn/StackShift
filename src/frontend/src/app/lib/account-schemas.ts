import { z } from 'zod';

export const AccountExportStatusSchema = z.enum(['Pending', 'Ready', 'Failed', 'Expired']);

export type AccountExportStatus = z.infer<typeof AccountExportStatusSchema>;

export const AccountExportRequestSchema = z.object({
  requestId: z.string().uuid(),
  status: AccountExportStatusSchema,
  requestedAt: z.string(),
  completedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  signedUrl: z.string().nullable(),
  sizeBytes: z.number().int().nullable(),
  manifestSha256: z.string().nullable(),
});

export type AccountExportRequest = z.infer<typeof AccountExportRequestSchema>;

export const AccountExportRequestListSchema = z.array(AccountExportRequestSchema);

// The exact phrase the user must type to confirm GDPR Article 17 erasure
// (matches RequestAccountDeletionCommandHandler.RequiredConfirmation).
export const ACCOUNT_DELETE_CONFIRMATION = 'DELETE my account';

export const AccountDeletionAcceptedSchema = z.object({
  requestId: z.string().uuid(),
  gracePeriodEndsAt: z.string(),
  cancellationToken: z.string(),
});

export type AccountDeletionAccepted = z.infer<typeof AccountDeletionAcceptedSchema>;
