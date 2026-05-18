import type { Metadata } from 'next';
import Link from 'next/link';
import { ProjectsList } from './_components/ProjectsList';

export const metadata: Metadata = { title: 'Projects | StackSift' };

// Server component — owns metadata and static shell.
// ProjectsList is 'use client' and does the data-fetching with TanStack Query.

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

      <ProjectsList />
    </div>
  );
}
