'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { RotateCw, Send, Trash2 } from 'lucide-react';
import { ApiKeyRevealModal } from '@/app/components/dialogs/ApiKeyRevealModal';
import { ConfirmDeleteByNameDialog } from '@/app/components/dialogs/ConfirmDeleteByNameDialog';
import { RegenerateKeyDialog } from '@/app/components/dialogs/RegenerateKeyDialog';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import { CopyableCode } from '@/app/components/ui/CopyableCode';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { Skeleton } from '@/app/components/ui/Skeleton';
import { useSession } from '@/app/hooks/useSession';
import { useLogSource } from '@/app/hooks/queries/use-log-source';
import {
  useDeleteLogSource,
  useRegenerateLogSourceKey,
  useTestIngest,
} from '@/app/hooks/mutations/use-log-sources';
import type { LogSourceCreated } from '@/app/types';

type SnippetTab = 'curl' | 'serilog' | 'winston';

interface LogSourceIntegrationViewProps {
  logSourceId: string;
}

export function LogSourceIntegrationView({ logSourceId }: LogSourceIntegrationViewProps) {
  const [tab, setTab] = useState<SnippetTab>('curl');
  const [pendingReveal, setPendingReveal] = useState<LogSourceCreated | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const { user } = useSession();
  const isAdminOrAbove = user?.role === 'owner' || user?.role === 'admin';

  const sourceQuery = useLogSource(logSourceId);
  const regenerate = useRegenerateLogSourceKey();
  const deleteSource = useDeleteLogSource();
  const testIngest = useTestIngest();

  const ingestUrl = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5190';
    return `${base.replace(/\/$/, '')}/api/v1/logs/ingest`;
  }, []);

  if (sourceQuery.isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-80 w-full rounded-lg" />
      </div>
    );
  }

  if (!sourceQuery.data) {
    return (
      <EmptyState
        title="Log source not found"
        description="This log source does not exist or you do not have access to it."
        className="min-h-[300px] rounded-lg border border-zinc-200 dark:border-zinc-800"
      />
    );
  }

  const source = sourceQuery.data;
  const maskedKey = `${source.keyPrefix}***************************`;

  const confirmRegenerate = () => {
    regenerate.mutate(source.id, {
      onSuccess: (created) => {
        setRegenerateOpen(false);
        setPendingReveal(created);
      },
    });
  };

  const confirmDelete = () => {
    deleteSource.mutate({ id: source.id, projectId: source.projectId });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{source.name}</h1>
            <Badge variant={source.isActive ? 'info' : 'neutral'} size="sm">
              {source.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <p className="mt-1 font-mono text-xs text-zinc-500">{maskedKey}</p>
          <p className="mt-2 text-sm text-zinc-500">
            Last used {source.keyLastUsedAt ? relativeTime(source.keyLastUsedAt) : 'never'}
            {source.keyRotatedAt ? ` · Rotated ${relativeTime(source.keyRotatedAt)}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => testIngest.mutate(source.id)}
            loading={testIngest.isPending}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            Send test event
          </Button>
          {isAdminOrAbove && (
            <>
              <Button type="button" variant="secondary" onClick={() => setRegenerateOpen(true)}>
                <RotateCw className="h-4 w-4" aria-hidden="true" />
                Regenerate
              </Button>
              <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex border-b border-zinc-200 p-2 dark:border-zinc-800">
          {(['curl', 'serilog', 'winston'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                tab === item
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`}
            >
              {item === 'serilog' ? 'Serilog' : item === 'winston' ? 'Winston' : 'curl'}
            </button>
          ))}
        </div>
        <div className="p-4">
          {tab === 'curl' && <CurlSnippet ingestUrl={ingestUrl} source={source} />}
          {tab === 'serilog' && <SerilogSnippet ingestUrl={ingestUrl} source={source} />}
          {tab === 'winston' && <WinstonSnippet ingestUrl={ingestUrl} source={source} />}
        </div>
      </div>

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500">
        <Link href={`/projects/${source.projectId}`} className="text-blue-600 hover:underline">
          Back to project
        </Link>
        <a
          href="https://github.com/drdtrn/StackSift/blob/main/docs/integrate/api-reference.md"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          Full API reference →
        </a>
      </p>

      {pendingReveal && (
        <ApiKeyRevealModal
          open
          apiKey={pendingReveal.apiKey}
          keyPrefix={pendingReveal.logSource.keyPrefix}
          onConfirmed={() => setPendingReveal(null)}
        />
      )}
      <RegenerateKeyDialog
        open={regenerateOpen}
        loading={regenerate.isPending}
        onClose={() => setRegenerateOpen(false)}
        onConfirm={confirmRegenerate}
      />
      <ConfirmDeleteByNameDialog
        open={deleteOpen}
        name={source.name}
        loading={deleteSource.isPending}
        onClose={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function CurlSnippet({ ingestUrl, source }: { ingestUrl: string; source: { projectId: string; id: string } }) {
  return (
    <CopyableCode
      language="bash"
      value={`curl -X POST "${ingestUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: <your-api-key>" \\
  -d '{
    "projectId": "${source.projectId}",
    "logSourceId": "${source.id}",
    "entries": [{
      "level": "info",
      "message": "hello from StackSift",
      "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
      "serviceName": "checkout-api",
      "metadata": { "environment": "production" }
    }]
  }'`}
    />
  );
}

function SerilogSnippet({
  ingestUrl,
  source,
}: {
  ingestUrl: string;
  source: { projectId: string; id: string };
}) {
  const csproj = `<PackageReference Include="StackSift.Serilog.Sink" Version="0.1.*" />`;
  const code = `using Serilog;
using StackSift.Serilog.Sink;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.StackSift(new StackSiftSinkOptions
    {
        IngestUrl   = "${ingestUrl}",
        ApiKey      = Environment.GetEnvironmentVariable("STACKSIFT_API_KEY")!,
        ProjectId   = new Guid("${source.projectId}"),
        LogSourceId = new Guid("${source.id}"),
        ServiceName = "your-service",
    })
    .CreateLogger();

Log.Information("Service started");
// ... your app code ...
await Log.CloseAndFlushAsync();`;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-zinc-500">
        Add the NuGet package, then chain <code>WriteTo.StackSift(...)</code> into your{' '}
        <code>LoggerConfiguration</code>. Set <code>STACKSIFT_API_KEY</code> in your
        environment — never commit it.
      </p>
      <CopyableCode language="xml" value={csproj} />
      <CopyableCode language="csharp" value={code} />
    </div>
  );
}

function WinstonSnippet({
  ingestUrl,
  source,
}: {
  ingestUrl: string;
  source: { projectId: string; id: string };
}) {
  const install = `pnpm add winston @stacksift/winston-transport`;
  const code = `import winston from 'winston';
import { StackSiftTransport } from '@stacksift/winston-transport';

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new StackSiftTransport({
      ingestUrl: '${ingestUrl}',
      apiKey: process.env.STACKSIFT_API_KEY!,
      projectId: '${source.projectId}',
      logSourceId: '${source.id}',
      serviceName: 'your-service',
    }),
  ],
});

logger.info('Service started');
// Before process exit: await transport.flush() on the StackSift transport.`;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-zinc-500">
        Install the package, then add the transport to your <code>winston.createLogger</code>{' '}
        call. Read the API key from <code>process.env.STACKSIFT_API_KEY</code>.
      </p>
      <CopyableCode language="bash" value={install} />
      <CopyableCode language="typescript" value={code} />
    </div>
  );
}

function relativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.round(diffHours / 24)}d ago`;
}
