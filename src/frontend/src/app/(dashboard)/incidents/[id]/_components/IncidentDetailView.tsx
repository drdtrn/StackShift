'use client';

import { useIncident, useIncidentAlerts } from '@/app/hooks/queries/use-incidents';
import { useAiAnalysis } from '@/app/hooks/queries/use-ai-analysis';
import { useSimilarIncidents } from '@/app/hooks/queries/use-similar-incidents';
import { useUpdateIncidentStatus } from '@/app/hooks/mutations/use-update-incident-status';
import { useTriggerAiAnalysis } from '@/app/hooks/mutations/use-trigger-ai-analysis';
import { Skeleton } from '@/app/components/ui/Skeleton';
import { IncidentHeader } from './IncidentHeader';
import { AlertsTimeline } from './AlertsTimeline';
import { AiAnalysisPanel } from './AiAnalysisPanel';
import { SimilarIncidents } from './SimilarIncidents';

interface IncidentDetailViewProps {
  id: string;
}

export function IncidentDetailView({ id }: IncidentDetailViewProps) {
  const { data: incident, isLoading: incidentLoading } = useIncident(id);
  const { data: alerts = [], isLoading: alertsLoading } = useIncidentAlerts(id);
  const { data: aiAnalysis } = useAiAnalysis(incident?.aiAnalysisId ?? null);
  const { data: similar = [], isLoading: similarLoading } = useSimilarIncidents(id);

  const updateStatus = useUpdateIncidentStatus();
  const triggerAnalysis = useTriggerAiAnalysis();

  if (incidentLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-40 w-full rounded-lg" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="col-span-2 flex flex-col gap-6">
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
          <div className="flex flex-col gap-6">
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="rounded-lg border border-line bg-surface p-8 text-center text-sm text-muted">
        Incident not found.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <IncidentHeader
        incident={incident}
        onUpdateStatus={(status) => updateStatus.mutate({ incidentId: id, status })}
        isUpdating={updateStatus.isPending}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column: alerts timeline */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <AlertsTimeline alerts={alerts} isLoading={alertsLoading} />
        </div>

        {/* Right column: AI analysis + similar incidents */}
        <div className="flex flex-col gap-6">
          <AiAnalysisPanel
            incident={incident}
            aiAnalysis={aiAnalysis}
            isTriggeringAnalysis={triggerAnalysis.isPending}
            onTrigger={() => triggerAnalysis.mutate({ incidentId: id })}
          />
          <SimilarIncidents items={similar} isLoading={similarLoading} />
        </div>
      </div>
    </div>
  );
}
