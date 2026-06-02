import type { Metadata } from 'next';
import { AccountDeletePanel } from '../../_components/AccountDeletePanel';

export const metadata: Metadata = { title: 'Delete account — Settings | StackSift' };

export default function AccountDeletePage() {
  return <AccountDeletePanel />;
}
