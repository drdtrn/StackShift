import type { LogQueryFilters } from '@/app/types';

export interface TimePreset {
  label: string;
  value: string;
  getRange: () => Pick<LogQueryFilters, 'startDate' | 'endDate'>;
}

function msAgo(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

export const TIME_PRESETS: TimePreset[] = [
  {
    label: '15m',
    value: '15m',
    getRange: () => ({ startDate: msAgo(15 * 60_000), endDate: new Date().toISOString() }),
  },
  {
    label: '1h',
    value: '1h',
    getRange: () => ({ startDate: msAgo(60 * 60_000), endDate: new Date().toISOString() }),
  },
  {
    label: '6h',
    value: '6h',
    getRange: () => ({ startDate: msAgo(6 * 60 * 60_000), endDate: new Date().toISOString() }),
  },
  {
    label: '24h',
    value: '24h',
    getRange: () => ({ startDate: msAgo(24 * 60 * 60_000), endDate: new Date().toISOString() }),
  },
  {
    label: '7d',
    value: '7d',
    getRange: () => ({ startDate: msAgo(7 * 24 * 60 * 60_000), endDate: new Date().toISOString() }),
  },
];

export const DEFAULT_PRESET = TIME_PRESETS[1]; // 1h
