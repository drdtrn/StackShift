import { z } from 'zod';

export const PlanSchema = z.enum(['Free', 'Indie', 'Team']);
export const SubscriptionStatusSchema = z.enum(['None', 'Active', 'PastDue', 'Canceled']);

export const SubscriptionSchema = z.object({
  plan: PlanSchema,
  status: SubscriptionStatusSchema,
  currentPeriodEnd: z.string().datetime({ offset: true }).nullable(),
  cancelAtPeriodEnd: z.boolean(),
  hasStripeCustomer: z.boolean(),
});

export const CheckoutSessionSchema = z.object({
  sessionId: z.string().min(1),
  url: z.string().url(),
});

export const PortalSessionSchema = z.object({
  url: z.string().url(),
});

export type Subscription = z.infer<typeof SubscriptionSchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;
export type CheckoutSession = z.infer<typeof CheckoutSessionSchema>;
export type PortalSession = z.infer<typeof PortalSessionSchema>;
