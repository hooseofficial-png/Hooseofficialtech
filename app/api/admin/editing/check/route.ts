import { NextResponse } from 'next/server';
import { sbAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin';
import { runChecks } from '@/lib/editing-engine';

// Admin · "ตรวจตอนนี้": run the deadline / overdue / finished checks right away.
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  try { return NextResponse.json({ ok: true, ...(await runChecks(sbAdmin())) }); }
  catch (e) { return NextResponse.json({ error: (e as Error).message.slice(0, 200) }, { status: 502 }); }
}
