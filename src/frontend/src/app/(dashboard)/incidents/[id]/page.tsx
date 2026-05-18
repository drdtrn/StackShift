import type { Metadata } from 'next';
import { IncidentDetailView } from './_components/IncidentDetailView';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Incident ${id} | StackSift` };
}

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <IncidentDetailView id={id} />;
}
