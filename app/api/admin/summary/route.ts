import { NextResponse } from 'next/server';
import { sbAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin';
import { clickupConfigured, currentTasks, editingTasks, stage } from '@/lib/clickup';

// Admin · numbers for the overview and analytics pages: editing (ClickUp), production and recruiting (Supabase).
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const DAY = 864e5;
const weekIndex = (ms: number, now: number) => Math.floor((now - ms) / (7 * DAY)); // 0 = this week

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const db = sbAdmin(); const now = Date.now();
  const today = new Date(now + 7 * 3600e3).toISOString().slice(0, 10);
  const in14 = new Date(now + 7 * 3600e3 + 14 * DAY).toISOString().slice(0, 10);
  const [{ data: lu }, { data: projects }, { data: crew }, { data: events }, { data: anns }, { data: calls }] = await Promise.all([
    db.from('line_users').select('role, status, created_at, applied_at, status_changed_at, needs_attention'),
    db.from('projects').select('id, name, start_date, end_date, created_at'),
    db.from('crew_positions').select('project_id, status'),
    db.from('events').select('project_id, type, date, time, title').gte('date', today).lte('date', in14).order('date'),
    db.from('announcements').select('status'),
    db.from('editing_calls').select('status, created_at, assigned_at')
  ]);

  const W = 12;
  const weeks = Array.from({ length: W }, (_, i) => ({ label: i === W - 1 ? 'นี้' : `-${W - 1 - i}`, applied: 0, follows: 0, done: 0, created: 0 }));
  const bump = (ms: number | null, key: 'applied' | 'follows' | 'done' | 'created') => {
    if (!ms) return; const w = weekIndex(ms, now); if (w >= 0 && w < W) weeks[W - 1 - w][key]++;
  };
  for (const u of lu || []) { bump(+new Date(u.created_at), 'follows'); if (u.applied_at) bump(+new Date(u.applied_at), 'applied'); }

  const recruiting = {
    waiting: (lu || []).filter(u => u.status === 'applied').length,
    attention: (lu || []).filter(u => u.needs_attention).length,
    team: { editor: (lu || []).filter(u => u.role === 'editor' && ['approved', 'active'].includes(u.status)).length, crew: (lu || []).filter(u => u.role === 'crew' && ['approved', 'active'].includes(u.status)).length },
    funnel: ['new', 'applying', 'applied', 'approved', 'active', 'rejected'].map(s => ({ status: s, n: (lu || []).filter(u => u.status === s).length })),
    followers: (lu || []).length
  };

  const live = (projects || []).filter(p => !p.end_date || p.end_date >= today);
  const production = {
    projects: (projects || []).length, live: live.length,
    openPositions: (crew || []).filter(c => c.status === 'open').length,
    pendingPositions: (crew || []).filter(c => c.status === 'pending').length,
    confirmedPositions: (crew || []).filter(c => c.status === 'confirmed').length,
    openCallsQueued: (anns || []).filter(a => a.status === 'queued').length,
    shoots: (events || []).filter(e => e.type === 'shoot').map(e => ({ ...e, project: (projects || []).find(p => p.id === e.project_id)?.name || '' })).slice(0, 8),
    perMonth: Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now); d.setMonth(d.getMonth() - (5 - i));
      const key = d.toISOString().slice(0, 7);
      return { label: d.toLocaleDateString('th-TH', { month: 'short' }), a: (projects || []).filter(p => (p.start_date || p.created_at || '').slice(0, 7) === key).length };
    })
  };

  let editing: Record<string, unknown> = { configured: clickupConfigured() };
  if (clickupConfigured()) {
    try {
      const tasks = await editingTasks();
      const open = currentTasks(tasks, now).current;
      for (const t of tasks) { bump(t.date_created, 'created'); if (stage(t) === 'done') bump(t.date_done, 'done'); }
      const per = new Map<string, number>();
      for (const t of tasks) if (stage(t) === 'done' && t.date_done && now - t.date_done < 30 * DAY) for (const a of t.assignees) per.set(a.username, (per.get(a.username) || 0) + 1);
      editing = {
        configured: true, open: open.length,
        unassigned: open.filter(t => !t.assignees.length).length,
        overdue: open.filter(t => t.due_date && t.due_date < now).length,
        dueSoon: open.filter(t => t.due_date && t.due_date >= now && t.due_date - now < 3 * DAY).length,
        review: open.filter(t => stage(t) === 'review').length,
        done30: tasks.filter(t => stage(t) === 'done' && t.date_done && now - t.date_done < 30 * DAY).length,
        perEditor: Array.from(per.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
        callsOpen: (calls || []).filter(c => c.status === 'open').length,
        callsAssigned30: (calls || []).filter(c => c.status === 'assigned' && c.assigned_at && now - +new Date(c.assigned_at) < 30 * DAY).length
      };
    } catch (e) { editing = { configured: true, error: (e as Error).message.slice(0, 200) }; }
  }
  return NextResponse.json({ editing, production, recruiting, weeks });
}
