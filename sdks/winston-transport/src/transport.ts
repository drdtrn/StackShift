import Transport from 'winston-transport';
import { buildBatch } from './payloadBuilder.js';
import type { ResolvedOptions, StackSiftTransportOptions } from './types.js';

interface WinstonInfo {
  level: string;
  message: unknown;
  timestamp?: string;
  [key: string]: unknown;
}

const DEFAULTS = {
  bufferSize: 100,
  flushInterval: 2000,
  requestTimeout: 10000,
  maxRetries: 5,
  initialRetryDelay: 1000,
  maxRetryDelay: 30000,
  queueCapacityMultiplier: 10,
};

export class StackSiftTransport extends Transport {
  private readonly options: ResolvedOptions;
  private readonly queue: WinstonInfo[] = [];
  private readonly queueCapacity: number;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;
  private pendingFlush: Promise<void> = Promise.resolve();
  private disposed = false;
  private droppedCount = 0;

  constructor(options: StackSiftTransportOptions) {
    super({
      level: options.level,
      silent: options.silent,
      handleExceptions: options.handleExceptions,
      handleRejections: options.handleRejections,
    });

    this.options = resolveOptions(options);
    this.queueCapacity = this.options.bufferSize * this.options.queueCapacityMultiplier;

    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.options.flushInterval);
    if (typeof this.flushTimer.unref === 'function') this.flushTimer.unref();
  }

  log(info: unknown, callback: () => void): void {
    setImmediate(() => this.emit('logged', info));

    if (this.disposed) {
      callback();
      return;
    }

    if (this.queue.length >= this.queueCapacity) {
      this.droppedCount++;
      callback();
      return;
    }

    this.queue.push(info as WinstonInfo);

    if (this.queue.length >= this.options.bufferSize) {
      void this.flush();
    }

    callback();
  }

  getDroppedCount(): number {
    return this.droppedCount;
  }

  async flush(): Promise<void> {
    if (this.flushing) {
      await this.pendingFlush;
      return;
    }

    if (this.queue.length === 0) return;

    this.flushing = true;
    this.pendingFlush = this.drainOnce().finally(() => {
      this.flushing = false;
    });
    await this.pendingFlush;
  }

  async close(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }

  private async drainOnce(): Promise<void> {
    const batch = this.queue.splice(0, this.options.bufferSize);
    if (batch.length === 0) return;

    const payload = JSON.stringify(buildBatch(batch, this.options));

    let attempt = 0;
    let delay = this.options.initialRetryDelay;

    for (;;) {
      attempt++;
      const result = await this.send(payload);

      if (result.outcome === 'success') return;

      if (result.outcome === 'drop-non-retryable') {
        this.droppedCount += batch.length;
        this.emit(
          'warn',
          new Error(`stacksift-transport: non-retryable HTTP ${result.status}; dropped ${batch.length} events.`),
        );
        return;
      }

      if (attempt > this.options.maxRetries) {
        this.droppedCount += batch.length;
        this.emit(
          'warn',
          new Error(
            `stacksift-transport: gave up after ${attempt - 1} retries (${result.outcome}); dropped ${batch.length} events.`,
          ),
        );
        return;
      }

      const retryAfter = result.outcome === 'retry-after' ? result.delayMs : delay;
      await wait(retryAfter);
      delay = Math.min(delay * 2, this.options.maxRetryDelay);
    }
  }

  private async send(payload: string): Promise<SendResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.requestTimeout);

    try {
      const response = await fetch(this.options.ingestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.options.apiKey,
          'User-Agent': 'StackSift-WinstonTransport/0.1.0',
        },
        body: payload,
        signal: controller.signal,
      });

      const status = response.status;
      if (status >= 200 && status < 300) return { outcome: 'success' };

      if (status === 429) {
        const header = response.headers.get('retry-after');
        const delayMs = parseRetryAfter(header) ?? this.options.initialRetryDelay;
        return { outcome: 'retry-after', delayMs };
      }

      if (status >= 500) {
        return { outcome: 'retry-server', status };
      }

      return { outcome: 'drop-non-retryable', status };
    } catch (err) {
      if ((err as Error).name === 'AbortError') return { outcome: 'retry-timeout' };
      return { outcome: 'retry-network', error: err as Error };
    } finally {
      clearTimeout(timeout);
    }
  }
}

type SendResult =
  | { outcome: 'success' }
  | { outcome: 'retry-after'; delayMs: number }
  | { outcome: 'retry-server'; status: number }
  | { outcome: 'retry-timeout' }
  | { outcome: 'retry-network'; error: Error }
  | { outcome: 'drop-non-retryable'; status: number };

function parseRetryAfter(header: string | null): number | null {
  if (header === null) return null;
  const seconds = Number.parseFloat(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const epoch = Date.parse(header);
  if (Number.isNaN(epoch)) return null;
  const diff = epoch - Date.now();
  return diff > 0 ? diff : null;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveOptions(input: StackSiftTransportOptions): ResolvedOptions {
  if (!input.ingestUrl) throw new TypeError('StackSiftTransportOptions.ingestUrl is required');
  if (!input.apiKey) throw new TypeError('StackSiftTransportOptions.apiKey is required');
  if (!input.projectId) throw new TypeError('StackSiftTransportOptions.projectId is required');
  if (!input.logSourceId) throw new TypeError('StackSiftTransportOptions.logSourceId is required');

  const bufferSize = input.bufferSize ?? DEFAULTS.bufferSize;
  if (bufferSize < 1 || bufferSize > 1000) {
    throw new RangeError('StackSiftTransportOptions.bufferSize must be in [1, 1000].');
  }

  return {
    ingestUrl: input.ingestUrl,
    apiKey: input.apiKey,
    projectId: input.projectId,
    logSourceId: input.logSourceId,
    serviceName: input.serviceName,
    hostName: input.hostName,
    bufferSize,
    flushInterval: input.flushInterval ?? DEFAULTS.flushInterval,
    requestTimeout: input.requestTimeout ?? DEFAULTS.requestTimeout,
    maxRetries: input.maxRetries ?? DEFAULTS.maxRetries,
    initialRetryDelay: input.initialRetryDelay ?? DEFAULTS.initialRetryDelay,
    maxRetryDelay: input.maxRetryDelay ?? DEFAULTS.maxRetryDelay,
    queueCapacityMultiplier: input.queueCapacityMultiplier ?? DEFAULTS.queueCapacityMultiplier,
  };
}
