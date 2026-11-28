import { NextResponse } from 'next/server';
import { sbAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin';
import { clickupConfigured, currentTasks, editingTasks, members } from '@/lib/clickup';
import { projectsOf, refLinks, statsFor } from '@/lib/editing';
import { getSetting } from '@/lib/settings';

// Admin · Editing by project: ClickUp parent tasks with their clips, LINE calls, and per-editor workload.
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!clickupConfigured()) return NextResponse.json({ configured: false });
  const db = sbAdmin();
  let loaded;
  try {
    loaded = await Promise.all([
      editingTasks(), members(),
      db.from('editing_calls').select('id, clickup_task_id, task_name, status, reason, sent_to, assigned_line_user_id, assigned_at, clickup_assigned, created_at').order('created_at', { ascending: false }).limit(200),
      db.from('line_users').select('line_user_id, full_name, display_name, clickup_user_id, status, following').eq('role', 'editor').in('status', ['approved', 'active']),
      getSetting(db, 'clickup_webhook_id')
    ]);
  } catch (e) { return NextResponse.json({ error: 'ดึงข้อมูล ClickUp ไม่สำเร็จ: ' + (e as Error).message.slice(0, 200) }, { status: 502 }); }
  const [tasks, team, { data: calls }, { data: editors }, webhook] = loaded;
  const now = Date.now();
  const callBy = new Map<string, NonNullable<typeof calls>[number]>();
  for (const c of calls || []) if (!callBy.has(c.clickup_task_id)) callBy.set(c.clickup_task_id, c);
  const lineByCu = new Map((editors || []).filter(e => e.clickup_user_id).map(e => [Number(e.clickup_user_id), e]));
  const projects = projectsOf(tasks, now).map(p => ({
    id: p.id, name: p.name, url: p.url, status: p.status, due: p.due, description: p.description.slice(0, 600), refs: refLinks(p.description),
    total: Math.max(1, p.clips.length), open: p.open.length, openNames: p.open.map(t => t.name).slice(0, 12),
    assignees: p.assignees, call: callBy.get(p.id) || null,
    state: p.due && p.due < now ? 'overdue' : p.due && p.due - now <= 3 * 864e5 ? 'due_soon' : 'ok'
  }));
  const people = team.filter(m => tasks.some(t => t.assignees.some(a => a.id === m.id)) || lineByCu.has(m.id))
    .map(m => ({ ...m, line: lineByCu.get(m.id) || null, stats: statsFor(tasks, m.id, now) }))
    .sort((a, b) => b.stats.active - a.stats.active);
  const done = projectsOf(tasks, now, true).filter(p => p.done && p.date_done && now - p.date_done < 14 * 864e5)
    .map(p => ({ id: p.id, name: p.name, url: p.url, total: Math.max(1, p.clips.length), date_done: p.date_done }));
  return NextResponse.json({
    configured: true, webhook: !!webhook, hiddenOld: currentTasks(tasks, now).hidden,
    unassigned: projects.filter(p => !p.assignees.length),
    inProgress: projects.filter(p => p.assignees.length),
    doneRecent: done, people,
    editorsOnLine: (editors || []).filter(e => e.following).length,
    unlinkedEditors: (editors || []).filter(e => !e.clickup_user_id).map(e => ({ line_user_id: e.line_user_id, name: e.full_name || e.display_name })),
    reassigned: (calls || []).filter(c => c.reason === 'reassign' && now - +new Date(c.created_at) < 14 * 864e5).length
  });
}
