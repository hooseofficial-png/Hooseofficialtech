import { NextResponse } from 'next/server';
import { sbAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin';
import { editingTasks } from '@/lib/clickup';
import { projectsOf } from '@/lib/editing';
import { announceProject } from '@/lib/editing-engine';

// Admin · announce one ClickUp project to approved editors on LINE (description, REF links and deadline
// from ClickUp). First to tap "รับโปรเจกต์นี้" gets it.
export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json().catch(() => ({})) as { project_id?: string; detail?: string; rate?: string };
  const p = projectsOf(await editingTasks(), Date.now(), true).find(x => x.id === b.project_id);
  if (!p) return NextResponse.json({ error: 'ไม่พบโปรเจกต์ใน ClickUp' }, { status: 404 });
  if (p.assignees.length) return NextResponse.json({ error: 'โปรเจกต์นี้มีคนตัดแล้วใน ClickUp' }, { status: 409 });
  const r = await announceProject(sbAdmin(), p, { detail: b.detail, rate: b.rate, reason: 'new', createdBy: admin });
  return 'error' in r && r.error ? NextResponse.json({ error: r.error }, { status: 400 }) : NextResponse.json(r);
}

/** Cancel an open call (nobody can take it any more). */
export async function DELETE(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id') || '';
  await sbAdmin().from('editing_calls').update({ status: 'cancelled' }).eq('id', id).eq('status', 'open');
  return NextResponse.json({ ok: true });
}
