import type { Metadata } from 'next';
import { SettingsTabs } from './_components/SettingsTabs';

export const metadata: Metadata = { title: 'Settings | StackSift' };

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Organisation, billing, and account preferences.
        </p>
      </div>
      <SettingsTabs />
      {children}
    </div>
  );
}
