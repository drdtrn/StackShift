'use client';

import Link from 'next/link';
import { Plus, Trash2 } from 'lucide-react';
import { EmptyState, Skeleton } from '@/app/components/ui';
import { useAlertRules } from '@/app/hooks/queries/use-alert-rules';
import { useProjects } from '@/app/hooks/queries/use-projects';
import { useUIStore } from '@/app/hooks/useUIStore';
import { useDeleteAlertRule, useUpdateAlertRule } from '@/app/hooks/mutations/use-create-alert-rule';
import type { AlertRule } from '@/app/types';

function formatRuleValue(rule: AlertRule): string {
  if (rule.pattern) return rule.pattern;
  if (rule.threshold !== null) return String(rule.threshold);
  return '-';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function AlertRulesView() {
  const activeProjectId = useUIStore((s) => s.activeProjectId);
  const { data: projects = [] } = useProjects();
  const selectedProjectId = activeProjectId ?? projects[0]?.id ?? null;
  const { data: rules = [], isLoading, isError } = useAlertRules(selectedProjectId);
  const updateRule = useUpdateAlertRule();
  const deleteRule = useDeleteAlertRule();

  const handleToggle = (rule: AlertRule) => {
    updateRule.mutate({
      id: rule.id,
      projectId: rule.projectId,
      name: rule.name,
      condition: rule.condition,
      threshold: rule.threshold,
      windowMinutes: rule.windowMinutes,
      logLevel: rule.logLevel,
      pattern: rule.pattern,
      isActive: !rule.isActive,
    });
  };

  const handleRename = (rule: AlertRule) => {
    const name = window.prompt('Alert rule name', rule.name)?.trim();
    if (!name || name === rule.name) return;

    updateRule.mutate({
      id: rule.id,
      projectId: rule.projectId,
      name,
      condition: rule.condition,
      threshold: rule.threshold,
      windowMinutes: rule.windowMinutes,
      logLevel: rule.logLevel,
      pattern: rule.pattern,
      isActive: rule.isActive,
    });
  };

  const handleDelete = (rule: AlertRule) => {
    if (window.confirm(`Delete alert rule "${rule.name}"?`)) {
      deleteRule.mutate({ id: rule.id, name: rule.name });
    }
  };

  if (!selectedProjectId) return null;

  if (isLoading) {
    return <Skeleton shape="rectangle" height="20rem" className="w-full rounded-lg" />;
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-line bg-surface p-8 text-sm text-muted">
        Could not load alert rules. Refresh the page to try again.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Link
          href="/alerts/new"
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New rule
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        {rules.length === 0 ? (
          <EmptyState
            title="No alert rules"
            description="Create a rule for the selected project."
            className="min-h-[260px]"
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-elevated text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Condition</th>
                <th className="px-4 py-3 text-left">Threshold / Pattern</th>
                <th className="px-4 py-3 text-left">Severity</th>
                <th className="px-4 py-3 text-left">Window</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-3 font-medium text-primary">{rule.name}</td>
                  <td className="px-4 py-3 capitalize text-muted">{rule.condition}</td>
                  <td className="px-4 py-3 text-muted">{formatRuleValue(rule)}</td>
                  <td className="px-4 py-3 capitalize text-muted">{rule.severity}</td>
                  <td className="px-4 py-3 text-muted">{rule.windowMinutes}m</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-elevated px-2 py-1 text-xs text-muted">
                      {rule.isActive ? 'Active' : 'Paused'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{formatDate(rule.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleRename(rule)}
                        className="rounded-md px-2 py-1 text-xs text-muted hover:bg-elevated hover:text-primary"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggle(rule)}
                        className="rounded-md px-2 py-1 text-xs text-muted hover:bg-elevated hover:text-primary"
                      >
                        {rule.isActive ? 'Pause' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(rule)}
                        className="rounded-md p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                        aria-label={`Delete ${rule.name}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
