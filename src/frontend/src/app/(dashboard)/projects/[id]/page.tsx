import type { Metadata } from 'next';

/**
 * Project detail page — maps to URL: /projects/:id
 *
 * Next.js 16: `params` is a Promise — must be awaited.
 *
 * Final implementation: project stats, log sources list, active alert rules,
 * and SDK integration snippet. Also entry point for editing project config.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Project ${id} | StackSift` };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Project</p>
        <h1 className="text-2xl font-semibold font-mono">{id}</h1>
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500 text-sm">
        Project detail (log sources, alert rules, SDK snippet) — coming soon.
      </div>
    </div>
  );
}
