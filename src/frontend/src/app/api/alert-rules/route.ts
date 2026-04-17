import { type NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/app/lib/auth/session';
import { alertRuleFormSchema } from '@/app/lib/schemas/alert-rule';
import type { AlertRule } from '@/app/types';

// ---------------------------------------------------------------------------
// POST /api/alert-rules
//
// Mock handler — creates a new AlertRule entity from the Alert Rule Builder.
//
// The handler maps the form's condition discriminated union to the domain's
// AlertRule shape (which uses the existing AlertRuleCondition type from
// domain.ts). The form uses rich condition types (ErrorRate, LogVolume, etc.);
// the stored entity collapses these to the existing domain conditions.
//
// Mapping:
//   ErrorRate  → 'threshold' (threshold = percentage, windowMinutes kept)
//   LogVolume  → 'threshold' (threshold = count, windowMinutes kept)
//   PatternMatch → 'pattern' (pattern + optional logLevel)
//   Latency    → 'threshold' (thresholdMs as threshold, windowMinutes = null)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const result = alertRuleFormSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: 'validation_failed', issues: result.error.issues },
      { status: 400 },
    );
  }

  const { name, projectId, condition } = result.data;
  const now = new Date().toISOString();

  // Map form condition to the domain AlertRule shape.
  let domainCondition: AlertRule['condition'];
  let threshold: number | null = null;
  let windowMinutes = 60;
  let logLevel: AlertRule['logLevel'] = null;
  let pattern: string | null = null;

  switch (condition.type) {
    case 'ErrorRate':
      domainCondition = 'threshold';
      threshold = condition.threshold;
      windowMinutes = condition.windowMinutes;
      break;
    case 'LogVolume':
      domainCondition = 'threshold';
      threshold = condition.threshold;
      windowMinutes = condition.windowMinutes;
      break;
    case 'PatternMatch':
      domainCondition = 'pattern';
      pattern = condition.pattern;
      logLevel = condition.logLevel ?? null;
      break;
    case 'Latency':
      domainCondition = 'threshold';
      threshold = condition.thresholdMs;
      windowMinutes = 0;
      break;
  }

  const alertRule: AlertRule = {
    id: crypto.randomUUID(),
    projectId,
    name,
    condition: domainCondition,
    threshold,
    windowMinutes,
    logLevel,
    pattern,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  return NextResponse.json(alertRule, { status: 201 });
}
