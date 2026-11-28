import { NextResponse } from 'next/server';
import { sbAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin';
import { editingTasks } from '@/lib/clickup';
import { projectsOf } from '@/lib/editing';
import { announceProject } from '@/lib/editing-engine';

// Admin · Open Call on LINE for a ClickUp project's remaining clips: description, REF links and deadline come
// straight from ClickUp (nothing to fill in). Current assignees are skipped. Nothing is written to ClickUp.
export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json().catch(() => ({})) as { project_id?: string };
  const p = projectsOf(await editingTasks(), Date.now(), true).find(x => x.id === b.project_id);
  if (!p) return NextResponse.json({ error: 'ไม่พบโปรเจกต์ใน ClickUp' }, { status: 404 });
  if (!p.open.length) return NextResponse.json({ error: 'โปรเจกต์นี้ไม่มีคลิปค้างแล้ว' }, { status: 400 });
  const db = sbAdmin();
  const reassign = p.assignees.length > 0;
  // Looking for a replacement (LINE only): the current assignees don't get the call. ClickUp is changed by the team.
  let exclude: string[] = [];
  if (reassign) {
    const { data } = await db.from('line_users').select('line_user_id').in('clickup_user_id', p.assignees.map(a => a.id));
    exclude = (data || []).map(x => x.line_user_id);
  }
  const r = await announceProject(db, p, { reason: reassign ? 'reassign' : 'new', exclude, createdBy: admin });
  return 'error' in r && r.error ? NextResponse.json({ error: r.error }, { status: 400 }) : NextResponse.json(r);
}

/** Cancel an open call (nobody can take it any more). */
export async function DELETE(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id') || '';
  await sbAdmin().from('editing_calls').update({ status: 'cancelled' }).eq('id', id).eq('status', 'open');
  return NextResponse.json({ ok: true });
}
