import pino, { type DestinationStream, type Logger } from 'pino';

const redactPaths = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers.set-cookie',
  'password',
  'token',
  '*.password',
  '*.token',
];

export function createAppLogger(destination?: DestinationStream): Logger {
  return pino(
    {
      base: { app: 'stacksift-frontend' },
      timestamp: pino.stdTimeFunctions.isoTime,
      redact: {
        paths: redactPaths,
        censor: '[REDACTED]',
      },
    },
    destination,
  );
}

export const logger = createAppLogger();
