'use client';

import { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import type { AiAnalysis, AiAnalysisStatus, Incident } from '@/app/types';

// ---------------------------------------------------------------------------
// Progress copy — cycles while the Hangfire job runs (8-15s).
// Gives the demo-day audience something to read instead of a spinner.
// ---------------------------------------------------------------------------

const PROGRESS_STEPS = [
  'Reading recent logs…',
  'Correlating error patterns…',
  'Generating analysis…',
  'Almost done…',
];

function ProgressText() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStep((s) => (s + 1) % PROGRESS_STEPS.length);
    }, 3_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-2 text-sm text-muted animate-pulse">
      <RefreshCw className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
      <span>{PROGRESS_STEPS[step]}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confidence score bar
// ---------------------------------------------------------------------------

function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const colour =
    pct >= 80 ? 'bg-green-500' :
    pct >= 50 ? 'bg-amber-500' :
                'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-elevated overflow-hidden">
        <div className={cn('h-full rounded-full', colour)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted tabular-nums w-8 text-right">{pct}%</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AiAnalysisPanel — state machine
//
// States:
//   idle        → incident.aiAnalysisId === null, mutation not pending
//   triggering  → mutation is pending (POST just fired)
//   pending     → aiAnalysis.status === 'pending'
//   processing  → aiAnalysis.status === 'processing'
//   completed   → aiAnalysis.status === 'completed'
//   failed      → aiAnalysis.status === 'failed'
// ---------------------------------------------------------------------------

export interface AiAnalysisPanelProps {
  incident: Incident;
  aiAnalysis: AiAnalysis | undefined;
  isTriggeringAnalysis: boolean;
  onTrigger: () => void;
}

type PanelState = 'idle' | 'triggering' | AiAnalysisStatus;

function deriveState(
  incident: Incident,
  aiAnalysis: AiAnalysis | undefined,
  isTriggering: boolean,
): PanelState {
  if (isTriggering) return 'triggering';
  if (!incident.aiAnalysisId) return 'idle';
  return aiAnalysis?.status ?? 'pending';
}

export function AiAnalysisPanel({
  incident,
  aiAnalysis,
  isTriggeringAnalysis,
  onTrigger,
}: AiAnalysisPanelProps) {
  const state = deriveState(incident, aiAnalysis, isTriggeringAnalysis);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-blue-400" aria-hidden="true" />
        <h2 className="text-base font-semibold">AI Analysis</h2>
      </div>

      <div className="rounded-lg border border-line bg-surface p-5">
        {/* ── Idle: show trigger button ─────────────────────────────────── */}
        {state === 'idle' && (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted">
              No analysis yet. Trigger the AI to get a plain-English root cause
              explanation and suggested fixes.
            </p>
            <button
              type="button"
              onClick={onTrigger}
              className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Analyze with AI
            </button>
          </div>
        )}

        {/* ── Triggering / Pending / Processing: busy state ─────────────── */}
        {(state === 'triggering' || state === 'pending' || state === 'processing') && (
          <div className="flex flex-col gap-4">
            <ProgressText />
            <p className="text-xs text-muted">
              Analysis typically completes in 8–15 seconds. Results will appear
              automatically — no need to refresh.
            </p>
          </div>
        )}

        {/* ── Completed: render all fields ──────────────────────────────── */}
        {state === 'completed' && aiAnalysis && (
          <div className="flex flex-col gap-5">
            {/* Confidence score */}
            {aiAnalysis.confidenceScore !== null && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted font-medium uppercase tracking-wider">
                  Confidence
                </span>
                <ConfidenceBar score={aiAnalysis.confidenceScore} />
              </div>
            )}

            {/* Summary */}
            {aiAnalysis.summary && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted font-medium uppercase tracking-wider">
                  Summary
                </span>
                <p className="text-sm leading-relaxed">{aiAnalysis.summary}</p>
              </div>
            )}

            {/* Root cause */}
            {aiAnalysis.rootCause && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted font-medium uppercase tracking-wider">
                  Root Cause
                </span>
                <p className="text-sm leading-relaxed text-amber-300">{aiAnalysis.rootCause}</p>
              </div>
            )}

            {/* Suggested fixes */}
            {aiAnalysis.suggestedFixes.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-xs text-muted font-medium uppercase tracking-wider">
                  Suggested Fixes
                </span>
                <ul className="flex flex-col gap-1.5">
                  {aiAnalysis.suggestedFixes.map((fix, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-400 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{fix}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ── Failed: show retry ────────────────────────────────────────── */}
        {state === 'failed' && (
          <div className="flex flex-col items-start gap-3">
            <div className="flex items-center gap-2 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Analysis failed. This can happen with insufficient log data.</span>
            </div>
            <button
              type="button"
              onClick={onTrigger}
              disabled={isTriggeringAnalysis}
              className="flex items-center gap-2 rounded-md border border-zinc-600 px-3 py-1.5 text-sm text-muted hover:text-primary hover:border-zinc-400 transition-colors disabled:opacity-40"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Retry analysis
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
