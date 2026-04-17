import type { Metadata } from 'next';

/**
 * Incident detail page — maps to URL: /incidents/:id
 *
 * Next.js 16: `params` is a Promise — must be awaited before accessing
 * any dynamic segment values. Failure to await causes a runtime error.
 *
 * Final implementation (US-05): log entries for the incident, AI root-cause
 * explanation panel (fetched on demand), similar past incidents via pgvector
 * semantic search, acknowledge / resolve actions.
 */
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Incident</p>
        <h1 className="text-2xl font-semibold font-mono">{id}</h1>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="col-span-2 rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500 text-sm">
          Log entries &amp; timeline — coming in US-05.
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500 text-sm">
          AI analysis panel — coming in US-05.
        </div>
      </div>
    </div>
  );
}
