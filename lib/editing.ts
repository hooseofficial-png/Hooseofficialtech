import type { SupabaseClient } from '@supabase/supabase-js';
import { currentTasks, members, stage, type CuTask } from './clickup';

/** ClickUp member id for a LINE editor: saved id, else match by email (application or app account). Saves a match. */
export async function clickupIdFor(db: SupabaseClient, lineUserId: string): Promise<number | null> {
  const { data: u } = await db.from('line_users').select('clickup_user_id, email, profile_id').eq('line_user_id', lineUserId).maybeSingle();
  if (!u) return null;
  if (u.clickup_user_id) return Number(u.clickup_user_id);
  const emails = new Set<string>();
  if (u.email) emails.add(u.email.toLowerCase());
  if (u.profile_id) {
    const { data: p } = await db.from('profiles').select('email').eq('id', u.profile_id).maybeSingle();
    if (p?.email) emails.add(p.email.toLowerCase());
  }
  if (!emails.size) return null;
  const m = (await members()).find(x => emails.has(x.email));
  if (!m) return null;
  await db.from('line_users').update({ clickup_user_id: m.id }).eq('line_user_id', lineUserId);
  return m.id;
}

export type EditorStats = { active: number; todo: number; review: number; overdue: number; dueSoon: number; done30: number; onTime: number | null };

/** Workload and performance numbers for one ClickUp member. */
export function statsFor(tasks: CuTask[], userId: number, now = Date.now()): EditorStats {
  const mine = tasks.filter(t => t.assignees.some(a => a.id === userId));
  const open = currentTasks(tasks, now).current.filter(t => t.assignees.some(a => a.id === userId));
  const done30 = mine.filter(t => stage(t) === 'done' && t.date_done && now - t.date_done < 30 * 864e5);
  const withDue = done30.filter(t => t.due_date);
  return {
    active: open.length,
    todo: open.filter(t => stage(t) === 'todo').length,
    review: open.filter(t => stage(t) === 'review').length,
    overdue: open.filter(t => t.due_date && t.due_date < now).length,
    dueSoon: open.filter(t => t.due_date && t.due_date >= now && t.due_date - now < 3 * 864e5).length,
    done30: done30.length,
    onTime: withDue.length ? Math.round(withDue.filter(t => t.date_done! <= t.due_date! + 864e5).length / withDue.length * 100) : null
  };
}

// ---------- Projects: a ClickUp parent task and its clips (subtasks) ----------

export type Project = {
  id: string; name: string; url: string; status: string; description: string;
  due: number | null;            // project due date, else the latest clip due date
  clips: CuTask[];               // subtasks (empty when the project is a single task)
  open: CuTask[];                // clips not finished (or the project itself when it has no clips)
  assignees: { id: number; username: string }[];
  done: boolean; date_updated: number; date_done: number | null; date_created: number;
};

const REF_RE = /https?:\/\/[^\s)>\]"']+/g;
/** Reference links found in a ClickUp description (video, drive, social). */
export function refLinks(text: string) {
  return Array.from(new Set((text || '').match(REF_RE) || [])).slice(0, 5);
}

/** Group the editing list into projects. Only current ones (see currentTasks) unless includeAll. */
export function projectsOf(tasks: CuTask[], now = Date.now(), includeAll = false): Project[] {
  const current = new Set(currentTasks(tasks, now).current.map(t => t.id));
  const children = new Map<string, CuTask[]>();
  for (const t of tasks) if (t.parent) children.set(t.parent, [...(children.get(t.parent) || []), t]);
  const roots = tasks.filter(t => !t.parent);
  const out: Project[] = [];
  for (const r of roots) {
    const clips = (children.get(r.id) || []).sort((a, b) => a.name.localeCompare(b.name, 'th', { numeric: true }));
    const done = stage(r) === 'done' || (clips.length > 0 && clips.every(c => stage(c) === 'done'));
    const open = clips.length ? clips.filter(c => stage(c) !== 'done') : (done ? [] : [r]);
    const live = current.has(r.id) || open.some(c => current.has(c.id));
    if (!includeAll && (done || !live)) continue;
    const dues = [r.due_date, ...clips.map(c => c.due_date)].filter((x): x is number => !!x);
    const people = new Map<number, string>();
    for (const t of [r, ...open]) for (const a of t.assignees) people.set(a.id, a.username);
    out.push({
      id: r.id, name: r.name, url: r.url, status: r.status, description: r.description,
      due: r.due_date || (dues.length ? Math.max(...dues) : null), clips, open,
      assignees: Array.from(people.entries()).map(([id, username]) => ({ id, username })),
      done, date_created: r.date_created, date_updated: Math.max(r.date_updated, ...clips.map(c => c.date_updated)), date_done: done ? (r.date_done || Math.max(0, ...clips.map(c => c.date_done || 0)) || null) : null
    });
  }
  return out.sort((a, b) => (a.due || 9e15) - (b.due || 9e15));
}
