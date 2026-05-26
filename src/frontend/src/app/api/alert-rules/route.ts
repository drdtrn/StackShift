import { NextResponse } from 'next/server';

export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'alert_rules_api_moved' },
    { status: 410 },
  );
}
