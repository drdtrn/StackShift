import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Billing — StackSift',
};

// Stand-alone billing landing layout for the Stripe success and cancel pages.
// Deliberately bypasses the (dashboard) layout so a logged-out browser returning
// from Stripe Checkout — e.g. after a long payment flow during which the BFF
// session expired — lands on a real page instead of being bounced to /landing.
export default function BillingLayout({ children }: { children: React.ReactNode }) {
  return (
    <main
      id="main-content"
      className="min-h-screen flex items-center justify-center px-6 py-16 bg-canvas text-primary"
    >
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
