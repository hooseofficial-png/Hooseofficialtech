import { NextResponse } from 'next/server';
import { sbAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin';
import { clickupConfigured, editingTasks } from '@/lib/clickup';
import { projectsOf } from '@/lib/editing';

// Admin · monthly analytics (last 6 months, Asia/Bangkok):
//  recruiting per team (editors / production crew): applicants, approved, team size, growth
//  editing projects (ClickUp parent tasks): new, in progress at month end, finished
//  production projects (HOOSE app): new, in progress at month end, wrapped
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const TZ = 7 * 3600e3;
type Month = { key: string; label: string; start: number; end: number };

function lastMonths(n: number): Month[] {
  const now = new Date(Date.now() + TZ);
  return Array.from({ length: n }, (_, i) => {
    const y = now.getUTCFullYear(), m = now.getUTCMonth() - (n - 1 - i);
    const start = Date.UTC(y, m, 1) - TZ, end = Date.UTC(y, m + 1, 1) - TZ;
    const d = new Date(start + TZ);
    return { key: d.toISOString().slice(0, 7), label: d.toLocaleDateString('th-TH', { month: 'short', year: '2-digit', timeZone: 'UTC' }), start, end };
  });
}
const t = (s: string | null | undefined) => (s ? +new Date(s) : 0);
const inM = (ms: number, m: Month) => ms >= m.start && ms < m.end;
const growth = (cur: number, prev: number) => (prev ? Math.round((cur - prev) / prev * 100) : cur ? null : 0);

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const db = sbAdmin();
  const months = lastMonths(6);
  const [{ data: lu }, { data: projects }] = await Promise.all([
    db.from('line_users').select('role, status, created_at, applied_at, status_changed_at'),
    db.from('projects').select('id, name, created_at, start_date, end_date')
  ]);

  const team = (role: 'editor' | 'crew') => {
    const people = (lu || []).filter(u => u.role === role);
    const passed = (u: typeof people[number]) => ['approved', 'active'].includes(u.status);
    let prevSize = 0;
    return months.map((m, i) => {
      const size = people.filter(u => passed(u) && t(u.status_changed_at || u.applied_at) < m.end).length;
      const row = {
        month: m.label,
        applied: people.filter(u => inM(t(u.applied_at), m)).length,
        approved: people.filter(u => passed(u) && inM(t(u.status_changed_at), m)).length,
        rejected: people.filter(u => u.status === 'rejected' && inM(t(u.status_changed_at), m)).length,
        size, growth: i === 0 ? null : growth(size, prevSize)
      };
      prevSize = size; return row;
    });
  };

  const today = new Date(Date.now() + TZ).toISOString().slice(0, 10);
  const production = months.map(m => {
    const startDay = new Date(m.start + TZ).toISOString().slice(0, 10), endDay = new Date(m.end + TZ - 1).toISOString().slice(0, 10);
    const ps = (projects || []).filter(p => p.name || p.start_date);
    return {
      month: m.label,
      created: ps.filter(p => inM(t(p.created_at), m)).length,
      active: ps.filter(p => t(p.created_at) < m.end && (!p.end_date || p.end_date >= startDay) && (!p.start_date || p.start_date <= endDay)).length,
      wrapped: ps.filter(p => p.end_date && p.end_date >= startDay && p.end_date <= endDay && p.end_date < today).length
    };
  });

  let editing: { month: string; created: number; active: number; done: number; clipsDone: number }[] | null = null;
  let editingError = '';
  if (clickupConfigured()) {
    try {
      const tasks = await editingTasks();
      const all = projectsOf(tasks, Date.now(), true);
      editing = months.map(m => ({
        month: m.label,
        created: all.filter(p => inM(p.date_created, m)).length,
        // open projects count as running until 60 days after their last update (abandoned tests do not inflate it)
        active: all.filter(p => p.date_created < m.end && (p.done ? (p.date_done || 0) >= m.end : p.date_updated + 60 * 864e5 >= m.start)).length,
        done: all.filter(p => p.done && p.date_done && inM(p.date_done, m)).length,
        clipsDone: tasks.filter(x => x.parent && x.date_done && inM(x.date_done, m)).length
      }));
    } catch (e) { editingError = (e as Error).message.slice(0, 160); }
  }
  return NextResponse.json({ months: months.map(m => m.label), editors: team('editor'), crew: team('crew'), production, editing, editingError });
}
