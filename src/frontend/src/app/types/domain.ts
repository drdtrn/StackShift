// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type LogLevel = 'trace' | 'debug' | 'info' | 'warning' | 'error' | 'critical';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export type IncidentStatus = 'open' | 'acknowledged' | 'resolved' | 'closed';

export type UserRole = 'owner' | 'admin' | 'member' | 'viewer';

export type LogSourceType = 'application' | 'server' | 'database' | 'network' | 'custom';

export type AlertRuleCondition = 'threshold' | 'anomaly' | 'pattern' | 'absence';

export type AiAnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed';

// ---------------------------------------------------------------------------
// Core Entities
// ---------------------------------------------------------------------------

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  createdAt: string;
  updatedAt: string;
  logSourceCount: number;
  activeIncidentCount: number;
}

export interface LogSource {
  id: string;
  projectId: string;
  name: string;
  type: LogSourceType;
  ingestUrl: string;
  apiKey: string;
  isActive: boolean;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface LogEntry {
  id: string;
  projectId: string;
  logSourceId: string;
  level: LogLevel;
  message: string;
  timestamp: string;
  traceId: string | null;
  spanId: string | null;
  serviceName: string | null;
  hostName: string | null;
  metadata: Record<string, unknown>;
}

export interface AlertRule {
  id: string;
  projectId: string;
  name: string;
  condition: AlertRuleCondition;
  threshold: number | null;
  windowMinutes: number;
  logLevel: LogLevel | null;
  pattern: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  id: string;
  projectId: string;
  alertRuleId: string | null;
  severity: AlertSeverity;
  title: string;
  description: string;
  firedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  incidentId: string | null;
}

export interface Incident {
  id: string;
  projectId: string;
  status: IncidentStatus;
  title: string;
  description: string | null;
  severity: AlertSeverity;
  startedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  assigneeId: string | null;
  alertIds: string[];
  aiAnalysisId: string | null;
}

export interface AiAnalysis {
  id: string;
  incidentId: string;
  status: AiAnalysisStatus;
  summary: string | null;
  rootCause: string | null;
  suggestedFixes: string[];
  relevantLogIds: string[];
  confidenceScore: number | null;
  createdAt: string;
  completedAt: string | null;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  /** null means the user is authenticated but has not created an organisation yet (onboarding). */
  organizationId: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}
