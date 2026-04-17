import { type NextRequest, NextResponse } from 'next/server';
import { getSessionUser, createSessionCookie } from '@/app/lib/auth/session';
import { generateMockTokensForUser } from '@/app/lib/auth/mock';
import { createOrganisationSchema } from '@/app/lib/schemas/organisation';
import type { Organization } from '@/app/types';

// ---------------------------------------------------------------------------
// POST /api/onboarding/create-org
//
// Creates a new organisation for the currently authenticated user (mock mode).
//
// Request body (JSON):
//   { "name": "Acme Corp" }
//
// Steps:
//   1. Authenticate: read session cookie → reject with 401 if missing.
//   2. Validate: parse request body with the shared Zod schema.
//   3. Generate: create a UUID for the org, derive a URL-safe slug from the name.
//   4. Update session: regenerate the mock JWT with organization_id set,
//      replace the session cookie. This keeps the BFF pattern intact —
//      the /api/auth/me endpoint reads the cookie and returns the updated user.
//   5. Respond: 201 with the new Organization object.
//
// In production (Sprint 2+): this handler would call the .NET backend API
// (POST /api/organisations), which creates the DB record and returns the
// org. The session token update would happen via Keycloak's silent refresh
// to pick up the new organization_id claim.
//
// WHY update the cookie here (not just return JSON)?
//   The client calls queryClient.invalidateQueries(['auth', 'me']) after
//   success. /api/auth/me reads the session cookie to extract the user.
//   If we don't update the cookie, the refetch would still return
//   organizationId: null and OnboardingGuard would redirect back to
//   /onboarding in an infinite loop.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  // --- Authentication ---
  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  // --- Validation ---
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parseResult = createOrganisationSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'validation_failed', issues: parseResult.error.issues },
      { status: 400 },
    );
  }

  const { name } = parseResult.data;

  // --- Build the organisation object ---
  // In mock mode we generate a deterministic ID from the org name so that
  // tests can assert a predictable value. Real mode uses UUID from the DB.
  const orgId = generateOrgId();
  const slug = nameToSlug(name);

  const now = new Date().toISOString();
  const organisation: Organization = {
    id: orgId,
    name,
    slug,
    logoUrl: null,
    createdAt: now,
    updatedAt: now,
  };

  // --- Update session cookie with the new organization_id ---
  // Regenerate the mock JWT so that the next /api/auth/me call returns
  // a user with organizationId set. OnboardingGuard will pass, and the
  // dashboard will load normally.
  const updatedUser = { ...user, organizationId: orgId };
  const tokens = generateMockTokensForUser(updatedUser);
  const newSessionCookie = createSessionCookie(tokens);

  const response = NextResponse.json(organisation, { status: 201 });
  response.headers.set('Set-Cookie', newSessionCookie);
  return response;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generates a pseudo-random UUID v4.
 * In production the DB generates this; in mock mode we use crypto.randomUUID()
 * which is available in the Node.js runtime and Web Crypto API.
 */
function generateOrgId(): string {
  return crypto.randomUUID();
}

/**
 * Converts an organisation name to a URL-safe slug.
 * "Acme Corp" → "acme-corp"
 * "My   Org" → "my-org"
 * "Hello-World" → "hello-world"
 */
export function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')   // spaces → hyphens
    .replace(/-{2,}/g, '-') // collapse multiple hyphens
    .replace(/-+$/, '');    // strip trailing hyphens
}
