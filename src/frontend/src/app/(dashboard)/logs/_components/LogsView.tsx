'use client';

import { useState, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { LogFilterBar, type LogFilterState } from './LogFilterBar';
import { LogTable } from './LogTable';
import { useLogEntries, useLogAppend } from '@/app/hooks/queries/use-logs';
import { TIME_PRESETS, DEFAULT_PRESET } from '@/app/lib/time-presets';
import type { LogLevel, LogQueryFilters } from '@/app/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildApiFilters(state: LogFilterState): LogQueryFilters {
  return {
    levels: state.levels.length > 0 ? state.levels : undefined,
    projectId: state.projectId || undefined,
    search: state.search || undefined,
    startDate: state.startDate || undefined,
    endDate: state.endDate || undefined,
  };
}

function readInitialState(searchParams: URLSearchParams): LogFilterState {
  const presetValue = searchParams.get('preset') ?? DEFAULT_PRESET.value;
  const preset = TIME_PRESETS.find((p) => p.value === presetValue) ?? DEFAULT_PRESET;
  const range = preset.getRange();

  const rawLevels = searchParams.get('levels');
  const levels: LogLevel[] = rawLevels
    ? (rawLevels.split(',').filter(Boolean) as LogLevel[])
    : [];

  return {
    presetValue,
    startDate: searchParams.get('from') ?? range.startDate ?? '',
    endDate: searchParams.get('to') ?? range.endDate ?? '',
    levels,
    projectId: searchParams.get('project') ?? '',
    search: searchParams.get('q') ?? '',
  };
}

// ---------------------------------------------------------------------------
// LogsView — client shell; owns filter state and URL sync
// ---------------------------------------------------------------------------

export function LogsView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [filterState, setFilterState] = useState<LogFilterState>(() =>
    readInitialState(searchParams),
  );

  const apiFilters = useMemo(() => buildApiFilters(filterState), [filterState]);

  // Write filter changes back to the URL so the view is bookmarkable.
  // Uses router.replace so Back button isn't polluted with every keystroke.
  const updateFilter = (updates: Partial<LogFilterState>) => {
    setFilterState((prev) => {
      const next = { ...prev, ...updates };

      const params = new URLSearchParams();
      if (next.presetValue) params.set('preset', next.presetValue);
      if (next.projectId) params.set('project', next.projectId);
      if (next.levels.length) params.set('levels', next.levels.join(','));
      if (next.search) params.set('q', next.search);

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      return next;
    });
  };

  const resetFilters = () => {
    const range = DEFAULT_PRESET.getRange();
    updateFilter({
      presetValue: DEFAULT_PRESET.value,
      startDate: range.startDate ?? '',
      endDate: range.endDate ?? '',
      levels: [],
      projectId: '',
      search: '',
    });
  };

  const query = useLogEntries(apiFilters);
  const appendLog = useLogAppend(apiFilters);

  return (
    <div className="flex flex-col gap-4">
      <LogFilterBar filterState={filterState} onUpdate={updateFilter} />
      <LogTable query={query} appendLog={appendLog} onResetFilters={resetFilters} />
    </div>
  );
}
