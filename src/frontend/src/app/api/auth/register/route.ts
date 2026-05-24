import { type NextRequest, NextResponse } from 'next/server';
import { registerSchema } from '@/app/lib/schemas/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5190';

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const apiPayload = {
    email: parsed.data.email,
    password: parsed.data.password,
    displayName: parsed.data.displayName,
    isOwner: parsed.data.role === 'owner',
  };

  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiPayload),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: 'upstream_unreachable' }, { status: 502 });
  }

  // Pass status + body through verbatim so the form can distinguish 409
  // (duplicate email) from 400 (validation) without re-parsing.
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
  });
}
