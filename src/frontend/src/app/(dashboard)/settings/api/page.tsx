import type { Metadata } from 'next';
import { LogSourcesTable } from './_components/LogSourcesTable';

export const metadata: Metadata = {
  title: 'API settings | StackSift',
};

export default function ApiSettingsPage() {
  return <LogSourcesTable />;
}
