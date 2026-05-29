/**
 * @jest-environment node
 */

import { PassThrough } from 'node:stream';
import { createAppLogger } from '@/app/lib/logger';

function readLogLine(stream: PassThrough): Promise<string> {
  return new Promise((resolve) => {
    stream.once('data', (chunk: Buffer) => resolve(chunk.toString('utf8')));
  });
}

describe('logger', () => {
  it('writes JSON and redacts sensitive request fields', async () => {
    const stream = new PassThrough();
    const linePromise = readLogLine(stream);
    const testLogger = createAppLogger(stream);

    testLogger.info({
      req: {
        headers: {
          cookie: 'session=secret',
          authorization: 'Bearer secret',
        },
      },
      res: {
        headers: {
          'set-cookie': 'session=secret',
        },
      },
      password: 'secret',
      token: 'secret',
    }, 'test');

    const line = await linePromise;

    expect(line).toContain('"app":"stacksift-frontend"');
    expect(line).toContain('"cookie":"[REDACTED]"');
    expect(line).toContain('"authorization":"[REDACTED]"');
    expect(line).toContain('"set-cookie":"[REDACTED]"');
    expect(line).toContain('"password":"[REDACTED]"');
    expect(line).toContain('"token":"[REDACTED]"');
    expect(line).not.toContain('session=secret');
    expect(line).not.toContain('Bearer secret');
  });
});
