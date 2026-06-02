import { NextResponse } from 'next/server';
import { authConfig } from '@/app/lib/auth/config';

// GET /api/auth/forgot — 302s to Keycloak's reset-credentials flow. Keycloak
// owns password reset entirely (resetPasswordAllowed); it emails the user a
// link and, once reset, returns them to the app to sign in. No mock branch.
export async function GET(): Promise<NextResponse> {
  const url = new URL(authConfig.endpoints.resetCredentials);
  url.searchParams.set('client_id', authConfig.clientId);
  return NextResponse.redirect(url.toString());
}
