import type { Metadata } from 'next';
import { AlertsView } from './_components/AlertsView';

export const metadata: Metadata = { title: 'Alerts | StackSift' };

export default function AlertsPage() {
  return <AlertsView />;
}
