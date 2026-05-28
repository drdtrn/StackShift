import type { Metadata } from 'next';
import { LogSourceIntegrationView } from './_components/LogSourceIntegrationView';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Log source ${id} | StackSift` };
}

export default async function LogSourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LogSourceIntegrationView logSourceId={id} />;
}
