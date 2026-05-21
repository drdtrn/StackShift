import type { Metadata } from 'next';
import { BillingPanel } from '../_components/BillingPanel';

export const metadata: Metadata = { title: 'Billing — Settings | StackSift' };

export default function BillingPage() {
  return <BillingPanel />;
}
