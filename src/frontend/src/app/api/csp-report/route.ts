import { logger } from '@/app/lib/logger';

const routeLogger = logger.child({ route: '/api/csp-report' });

export async function POST(request: Request): Promise<Response> {
  const report = await request.text();
  routeLogger.warn({ report }, 'CSP violation reported');
  return new Response(null, { status: 204 });
}
