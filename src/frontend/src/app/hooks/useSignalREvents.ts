'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { LogEntry, Alert, AiAnalysis } from '@/app/types';
import type { IHubConnection } from '@/app/lib/signalr-mock';
import { useSignalRConnectionFromContext } from '@/app/hooks/useSignalRConnectionContext';
import {
  HUB_METHOD_LOG_ENTRY,
  HUB_METHOD_ALERT,
  HUB_METHOD_AI_ANALYSIS_COMPLETED,
  HUB_METHOD_SUBSCRIPTION_UPDATED,
} from '@/app/lib/signalr-config';
import { queryKeys } from '@/app/lib/query-keys';
import { useNotificationStore } from '@/app/hooks/useNotificationStore';
import type { Subscription } from '@/app/lib/billing-schemas';

type HubHandler = Parameters<IHubConnection['on']>[1];

export function useSignalREvents(): void {
  const connection = useSignalRConnectionFromContext();
  const queryClient = useQueryClient();
  const incrementUnread = useNotificationStore((s) => s.increment);

  useEffect(() => {
    if (!connection) return;

    const onLogEntry = (_entry: LogEntry) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.logs.all,
        refetchType: 'none',
      });
    };

    const onAlert = (_alert: Alert) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all });
      incrementUnread();
    };

    const onAiAnalysisCompleted = (analysis: AiAnalysis) => {
      queryClient.setQueryData(
        queryKeys.aiAnalyses.detail(analysis.id),
        analysis,
      );
      queryClient.invalidateQueries({
        queryKey: queryKeys.incidents.detail(analysis.incidentId),
      });
    };

    const onSubscriptionUpdated = (subscription: Subscription) => {
      queryClient.setQueryData(queryKeys.billing.subscription(), subscription);
    };

    const logEntryAdapter = onLogEntry as HubHandler;
    const alertAdapter = onAlert as HubHandler;
    const aiAdapter = onAiAnalysisCompleted as HubHandler;
    const subscriptionAdapter = onSubscriptionUpdated as HubHandler;

    connection.on(HUB_METHOD_LOG_ENTRY, logEntryAdapter);
    connection.on(HUB_METHOD_ALERT, alertAdapter);
    connection.on(HUB_METHOD_AI_ANALYSIS_COMPLETED, aiAdapter);
    connection.on(HUB_METHOD_SUBSCRIPTION_UPDATED, subscriptionAdapter);

    return () => {
      connection.off(HUB_METHOD_LOG_ENTRY, logEntryAdapter);
      connection.off(HUB_METHOD_ALERT, alertAdapter);
      connection.off(HUB_METHOD_AI_ANALYSIS_COMPLETED, aiAdapter);
      connection.off(HUB_METHOD_SUBSCRIPTION_UPDATED, subscriptionAdapter);
    };
  }, [connection, queryClient, incrementUnread]);
}
