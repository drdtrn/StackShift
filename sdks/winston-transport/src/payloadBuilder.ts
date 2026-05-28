import type { IngestBatch, IngestEntry, ResolvedOptions } from './types.js';
import { mapLevel } from './levelMapping.js';

const RESERVED_KEYS = new Set([
  'level',
  'message',
  'timestamp',
  'traceId',
  'spanId',
  'serviceName',
  'hostName',
]);

interface WinstonInfo {
  level: string;
  message: unknown;
  timestamp?: string;
  traceId?: string;
  spanId?: string;
  serviceName?: string;
  hostName?: string;
  [key: string]: unknown;
}

export function buildEntry(info: WinstonInfo, options: ResolvedOptions): IngestEntry {
  const metadata: Record<string, unknown> = {};
  for (const key of Object.keys(info)) {
    if (RESERVED_KEYS.has(key)) continue;
    if (key.startsWith('Symbol(')) continue;
    metadata[key] = info[key];
  }

  const entry: IngestEntry = {
    level: mapLevel(info.level),
    message: stringifyMessage(info.message),
    timestamp: info.timestamp ?? new Date().toISOString(),
  };

  const trace = info.traceId;
  if (typeof trace === 'string' && trace.length > 0) entry.traceId = trace;

  const span = info.spanId;
  if (typeof span === 'string' && span.length > 0) entry.spanId = span;

  const service = info.serviceName ?? options.serviceName;
  if (typeof service === 'string' && service.length > 0) entry.serviceName = service;

  const host = info.hostName ?? options.hostName;
  if (typeof host === 'string' && host.length > 0) entry.hostName = host;

  if (Object.keys(metadata).length > 0) entry.metadata = metadata;

  return entry;
}

export function buildBatch(infos: WinstonInfo[], options: ResolvedOptions): IngestBatch {
  return {
    projectId: options.projectId,
    logSourceId: options.logSourceId,
    entries: infos.map((info) => buildEntry(info, options)),
  };
}

function stringifyMessage(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  if (value instanceof Error) return value.stack ?? value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
