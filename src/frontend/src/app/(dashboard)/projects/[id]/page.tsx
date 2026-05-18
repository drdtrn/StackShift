import type { Metadata } from 'next';
import { ProjectDetailView } from './_components/ProjectDetailView';

// Next.js 15: params is a Promise — must be awaited in async server components.

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

  // Server component: resolve params, then hand off to the client component
  // that owns TanStack Query data-fetching.
  return <ProjectDetailView projectId={id} />;
}
