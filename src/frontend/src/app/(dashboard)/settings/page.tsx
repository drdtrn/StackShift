import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Settings | StackSift' };

/**
 * Settings page — maps to URL: /settings
 *
 * Final implementation: organisation settings (name, logo), team management
 * (invite / remove members, change roles), API key management, and
 * notification channel configuration (email, Slack webhook).
 */
export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Organisation, team members, API keys, and notifications.
        </p>
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500 text-sm">
        Settings panels coming soon.
      </div>
    </div>
  );
}
