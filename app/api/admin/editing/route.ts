import { NextResponse } from 'next/server';
import { sbAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin';
import { clickupConfigured, currentTasks, editingTasks, members, stage } from '@/lib/clickup';
import { statsFor } from '@/lib/editing';

// Admin · Editing: ClickUp tasks of the editing list(s), job calls sent on LINE, and per-editor workload.
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!clickupConfigured()) return NextResponse.json({ configured: false });
  const db = sbAdmin();
  let loaded;
  try { loaded = await Promise.all([
    editingTasks(), members(),
    db.from('editing_calls').select('id, clickup_task_id, task_name, status, sent_to, assigned_line_user_id, assigned_at, clickup_assigned, created_at').order('created_at', { ascending: false }).limit(200),
    db.from('line_users').select('line_user_id, full_name, display_name, picture_url, clickup_user_id, status, following').eq('role', 'editor').in('status', ['approved', 'active'])
  ]); } catch (e) { return NextResponse.json({ error: 'ดึงข้อมูล ClickUp ไม่สำเร็จ: ' + (e as Error).message.slice(0, 200) }, { status: 502 }); }
  const [tasks, team, { data: calls }, { data: editors }] = loaded;
  const now = Date.now();
  const { current: open, hidden } = currentTasks(tasks, now);
  const callByTask = new Map<string, NonNullable<typeof calls>[number]>();
  for (const c of calls || []) if (!callByTask.has(c.clickup_task_id)) callByTask.set(c.clickup_task_id, c);
  const lineByCu = new Map((editors || []).filter(e => e.clickup_user_id).map(e => [Number(e.clickup_user_id), e]));
  const people = team.filter(m => tasks.some(t => t.assignees.some(a => a.id === m.id)) || lineByCu.has(m.id))
    .map(m => ({ ...m, line: lineByCu.get(m.id) || null, stats: statsFor(tasks, m.id, now) }))
    .sort((a, b) => b.stats.active - a.stats.active);
  const slim = (t: typeof tasks[number]) => ({ ...t, stage: stage(t), call: callByTask.get(t.id) || null });
  return NextResponse.json({
    configured: true, hiddenOld: hidden,
    unassigned: open.filter(t => !t.assignees.length).map(slim).sort((a, b) => (a.due_date || 9e15) - (b.due_date || 9e15)),
    inProgress: open.filter(t => t.assignees.length).map(slim).sort((a, b) => (a.due_date || 9e15) - (b.due_date || 9e15)),
    doneRecent: tasks.filter(t => stage(t) === 'done' && t.date_done && now - t.date_done < 14 * 864e5).map(slim).sort((a, b) => (b.date_done || 0) - (a.date_done || 0)),
    people,
    editorsOnLine: (editors || []).filter(e => e.following).length,
    unlinkedEditors: (editors || []).filter(e => !e.clickup_user_id).map(e => ({ line_user_id: e.line_user_id, name: e.full_name || e.display_name }))
  });
}
