import type { SupabaseClient } from '@supabase/supabase-js';
import { members, stage, type CuTask } from './clickup';

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
  const open = mine.filter(t => stage(t) !== 'done');
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
