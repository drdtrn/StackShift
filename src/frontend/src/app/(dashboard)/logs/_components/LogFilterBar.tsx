'use client';

import { useState, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';
import { TIME_PRESETS } from '@/app/lib/time-presets';
import { useProjects } from '@/app/hooks/queries/use-projects';
import { cn } from '@/app/lib/utils';
import type { LogLevel } from '@/app/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LogFilterState {
  presetValue: string;
  startDate: string;
  endDate: string;
  levels: LogLevel[];
  projectId: string;
  search: string;
}

export interface LogFilterBarProps {
  filterState: LogFilterState;
  onUpdate: (updates: Partial<LogFilterState>) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_LEVELS: LogLevel[] = ['trace', 'debug', 'info', 'warning', 'error', 'critical'];

const LEVEL_COLOUR: Record<LogLevel, string> = {
  trace:    'border-zinc-600 text-zinc-400 data-[active=true]:bg-zinc-700 data-[active=true]:border-zinc-500 data-[active=true]:text-zinc-200',
  debug:    'border-zinc-600 text-zinc-400 data-[active=true]:bg-zinc-700 data-[active=true]:border-zinc-500 data-[active=true]:text-zinc-200',
  info:     'border-sky-700  text-sky-400  data-[active=true]:bg-sky-900/40 data-[active=true]:border-sky-500 data-[active=true]:text-sky-300',
  warning:  'border-amber-700 text-amber-400 data-[active=true]:bg-amber-900/30 data-[active=true]:border-amber-500 data-[active=true]:text-amber-300',
  error:    'border-red-700  text-red-400  data-[active=true]:bg-red-900/30  data-[active=true]:border-red-500  data-[active=true]:text-red-300',
  critical: 'border-rose-700 text-rose-400 data-[active=true]:bg-rose-900/30 data-[active=true]:border-rose-500 data-[active=true]:text-rose-300',
};

// ---------------------------------------------------------------------------
// Internal debounce hook
// ---------------------------------------------------------------------------

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

// ---------------------------------------------------------------------------
// LogFilterBar
// ---------------------------------------------------------------------------

export function LogFilterBar({ filterState, onUpdate }: LogFilterBarProps) {
  const { data: projects = [] } = useProjects();

  // Local search state with 300ms debounce before pushing to parent
  const [searchInput, setSearchInput] = useState(filterState.search);
  const debouncedSearch = useDebounce(searchInput, 300);

  useEffect(() => {
    if (debouncedSearch !== filterState.search) {
      onUpdate({ search: debouncedSearch });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const toggleLevel = (level: LogLevel) => {
    const current = filterState.levels;
    const next = current.includes(level)
      ? current.filter((l) => l !== level)
      : [...current, level];
    onUpdate({ levels: next });
  };

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 items-center rounded-lg border border-line bg-surface p-3">
      {/* ── Time range presets ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 shrink-0" role="group" aria-label="Time range">
        {TIME_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => {
              const range = preset.getRange();
              onUpdate({
                presetValue: preset.value,
                startDate: range.startDate ?? '',
                endDate: range.endDate ?? '',
              });
            }}
            className={cn(
              'px-2.5 py-1 rounded text-xs font-medium transition-colors',
              filterState.presetValue === preset.value
                ? 'bg-blue-600 text-white'
                : 'bg-elevated text-muted hover:text-primary',
            )}
            aria-pressed={filterState.presetValue === preset.value}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="h-4 w-px bg-line shrink-0" aria-hidden="true" />

      {/* ── Severity multi-select ──────────────────────────────────────────── */}
      <div
        className="flex items-center gap-1 flex-wrap"
        role="group"
        aria-label="Filter by severity"
      >
        {ALL_LEVELS.map((level) => {
          const active = filterState.levels.includes(level);
          return (
            <button
              key={level}
              type="button"
              data-active={active}
              onClick={() => toggleLevel(level)}
              className={cn(
                'px-2 py-0.5 rounded text-xs font-medium capitalize border transition-colors',
                'bg-transparent',
                LEVEL_COLOUR[level],
              )}
              aria-pressed={active}
            >
              {level}
            </button>
          );
        })}
      </div>

      <div className="h-4 w-px bg-line shrink-0" aria-hidden="true" />

      {/* ── Project select ─────────────────────────────────────────────────── */}
      <select
        value={filterState.projectId}
        onChange={(e) => onUpdate({ projectId: e.target.value })}
        className="rounded bg-elevated border border-line text-xs text-primary px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Filter by project"
      >
        <option value="">All projects</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      {/* ── Free-text search ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 flex-1 min-w-52">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder='Search logs…'
          className="w-full rounded bg-elevated border border-line text-xs text-primary px-3 py-1.5 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Search log messages"
        />
        <div className="group relative shrink-0">
          <HelpCircle className="h-3.5 w-3.5 text-muted hover:text-primary cursor-help" />
          <div className="absolute right-0 top-5 z-10 hidden group-hover:block w-64 rounded border border-line bg-surface p-2 text-xs text-muted shadow-lg">
            Hits Elasticsearch. Examples:
            <br />
            <code className="text-zinc-300">error AND service:&quot;api-gateway&quot;</code>
          </div>
        </div>
      </div>
    </div>
  );
}
