import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Projects | StackSift' };

/**
 * Projects list page — maps to URL: /projects
 *
 * Final implementation (US-07): card grid of projects with name, description,
 * log source type badge, last active timestamp, and alert count.
 * Links to /projects/new for onboarding.
 */
export default function ProjectsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Monitored services and log sources.
          </p>
        </div>
        <Link
          href="/projects/new"
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          New project
        </Link>
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500 text-sm">
        Project cards coming in US-07.
      </div>
    </div>
  );
}
