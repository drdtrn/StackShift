import type { Metadata } from 'next';
import { AccountDataPanel } from '../../_components/AccountDataPanel';

export const metadata: Metadata = { title: 'Your data — Settings | StackSift' };

export default function AccountDataPage() {
  return <AccountDataPanel />;
}
