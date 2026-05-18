'use client';

import Link from 'next/link';
import { Layers, AlertTriangle } from 'lucide-react';
import type { Project } from '@/app/types';

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
    >
      {/* Color bar + name row */}
      <div className="flex items-center gap-3">
        <span
          className="h-3 w-3 flex-shrink-0 rounded-full"
          style={{ backgroundColor: project.color }}
          aria-hidden="true"
        />
        <h2 className="truncate text-sm font-semibold group-hover:text-blue-600 dark:group-hover:text-blue-400">
          {project.name}
        </h2>
      </div>

      {/* Description */}
      {project.description && (
        <p className="line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
          {project.description}
        </p>
      )}

      {/* Counts */}
      <div className="mt-auto flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1">
          <Layers className="h-3.5 w-3.5" aria-hidden="true" />
          {project.logSourceCount} log source{project.logSourceCount !== 1 ? 's' : ''}
        </span>
        {project.activeIncidentCount > 0 && (
          <span className="flex items-center gap-1 text-amber-500 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            {project.activeIncidentCount} incident{project.activeIncidentCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </Link>
  );
}
