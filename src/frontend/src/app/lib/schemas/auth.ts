import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email: z
    .string()
    .email('Enter a valid email address.')
    .max(200, 'Email is too long.'),
  password: z
    .string()
    .min(12, 'Must be at least 12 characters.')
    .regex(/[A-Z]/, 'Must contain an uppercase letter.')
    .regex(/[a-z]/, 'Must contain a lowercase letter.')
    .regex(/\d/, 'Must contain a digit.'),
  displayName: z
    .string()
    .min(2, 'Display name must be at least 2 characters.')
    .max(80, 'Display name must be at most 80 characters.'),
  role: z.enum(['owner', 'viewer']),
});

export type RegisterFormValues = z.infer<typeof registerSchema>;

export const registerApiPayloadSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  displayName: z.string().min(2).max(80),
  isOwner: z.boolean(),
});

export type RegisterApiPayload = z.infer<typeof registerApiPayloadSchema>;

export const registerApiResultSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'member', 'viewer']),
  organizationId: z.string().uuid().nullable(),
  attachedViaInvitation: z.boolean(),
});

export type RegisterApiResult = z.infer<typeof registerApiResultSchema>;
