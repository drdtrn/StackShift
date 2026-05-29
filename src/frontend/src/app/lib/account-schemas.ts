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
