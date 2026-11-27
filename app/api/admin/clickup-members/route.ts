import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { clickupConfigured, members } from '@/lib/clickup';

export const dynamic = 'force-dynamic';
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!clickupConfigured()) return NextResponse.json({ members: [] });
  return NextResponse.json({ members: await members() });
}
