import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const HEALTH_TIMEOUT_MS = 800;

function backendUrl(): string {
  return process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5190';
}

export async function GET(): Promise<NextResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

  try {
    const response = await fetch(`${backendUrl()}/health/ready`, {
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, reason: `backend ${response.status}` },
        { status: 503 },
      );
    }

    return NextResponse.json({ ok: true, ts: new Date().toISOString() });
  } catch {
    const reason = controller.signal.aborted ? 'abort' : 'backend health check failed';
    return NextResponse.json({ ok: false, reason }, { status: 503 });
  } finally {
    clearTimeout(timeout);
  }
}
