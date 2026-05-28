export interface StackSiftTransportOptions {
  ingestUrl: string;
  apiKey: string;
  projectId: string;
  logSourceId: string;

  serviceName?: string;
  hostName?: string;

  bufferSize?: number;
  flushInterval?: number;
  requestTimeout?: number;

  maxRetries?: number;
  initialRetryDelay?: number;
  maxRetryDelay?: number;

  queueCapacityMultiplier?: number;

  level?: string;
  silent?: boolean;
  handleExceptions?: boolean;
  handleRejections?: boolean;
}

export interface ResolvedOptions extends Required<Omit<StackSiftTransportOptions,
  'serviceName' | 'hostName' | 'level' | 'silent' | 'handleExceptions' | 'handleRejections'
>> {
  serviceName?: string;
  hostName?: string;
}

export interface IngestEntry {
  level: string;
  message: string;
  timestamp: string;
  traceId?: string;
  spanId?: string;
  serviceName?: string;
  hostName?: string;
  metadata?: Record<string, unknown>;
}

export interface IngestBatch {
  projectId: string;
  logSourceId: string;
  entries: IngestEntry[];
}
