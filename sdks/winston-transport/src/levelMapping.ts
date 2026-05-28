const NPM_TO_STACKSIFT: Record<string, string> = {
  silly: 'Trace',
  trace: 'Trace',
  verbose: 'Debug',
  debug: 'Debug',
  info: 'Info',
  http: 'Info',
  warn: 'Warning',
  warning: 'Warning',
  error: 'Error',
  fatal: 'Critical',
  critical: 'Critical',
};

export function mapLevel(level: string): string {
  const key = (level ?? '').toLowerCase();
  return NPM_TO_STACKSIFT[key] ?? 'Info';
}
