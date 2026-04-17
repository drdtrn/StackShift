import { type NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/app/lib/auth/session';
import { projectFormSchema } from '@/app/lib/schemas/project';
import type { Project } from '@/app/types';

// ---------------------------------------------------------------------------
// POST /api/projects
//
// Mock handler — creates a new Project entity from the New Project Wizard.
//
// Request body (JSON): ProjectFormInput (name, description, logSourceConfig)
//
// Flow:
//   1. Authenticate: reject with 401 if no session.
//   2. Validate: safeParse the body against projectFormSchema — same schema
//      the client used. If validation fails here, a request was crafted
//      outside the form (or the schema drifted). Return 400 with issues.
//   3. Build: generate UUID, derive slug, populate Project fields.
//   4. Respond: 201 with the new Project object.
//
// In production this handler would call POST /api/v1/projects on the .NET
// backend. The mock keeps UI development independent of the backend.
//
// WHY validate on the server even though the client already validated?
//   The client-side schema is a UX convenience — it gives instant feedback.
//   But the client can be bypassed (curl, Postman, a bug in JS). Server-side
//   validation is the authoritative gate. Using the same Zod schema for both
//   guarantees consistency with zero duplication.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  // --- Authentication ---
  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  // --- Parse body ---
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // --- Validate ---
  const result = projectFormSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: 'validation_failed', issues: result.error.issues },
      { status: 400 },
    );
  }

  const { name, description, logSourceConfig } = result.data;

  // --- Build the project ---
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const project: Project = {
    id,
    organizationId: user.organizationId ?? '',
    name,
    slug: nameToSlug(name),
    description: description ?? null,
    // Pick a colour from a palette based on the ID — deterministic but varied.
    color: PROJECT_COLORS[id.charCodeAt(0) % PROJECT_COLORS.length],
    createdAt: now,
    updatedAt: now,
    logSourceCount: 1, // The wizard creates one log source immediately.
    activeIncidentCount: 0,
  };

  // In production: also create a LogSource entity from logSourceConfig and
  // associate it with the project. For mock purposes we just log it.
  void logSourceConfig; // referenced to satisfy linter

  return NextResponse.json(project, { status: 201 });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROJECT_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#06b6d4', // cyan
];

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/-+$/, '');
}
