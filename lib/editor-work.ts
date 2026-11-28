import type { SupabaseClient } from '@supabase/supabase-js';
import { clickupConfigured, currentTasks, editingTasks, stage } from './clickup';
import { clickupIdFor, projectsOf, statsFor } from './editing';

/** Editor home data (LINE page and /editor): their ClickUp projects, open clips, recent done and performance. */
export async function editorWork(db: SupabaseClient, lineUserId: string) {
  const { data: u } = await db.from('line_users').select('full_name, display_name, picture_url, role, status').eq('line_user_id', lineUserId).maybeSingle();
  if (!u || !['approved', 'active'].includes(u.status)) return ({ linked: false, reason: 'not_member', user: u });
  if (!clickupConfigured()) return ({ linked: false, reason: 'no_clickup', user: u });
  const cid = await clickupIdFor(db, lineUserId);
  if (!cid) return ({ linked: false, reason: 'no_account', user: u });
  const tasks = await editingTasks();
  const mine = tasks.filter(t => t.assignees.some(a => a.id === cid));
  const now = Date.now();
  const pick = (t: typeof mine[number]) => ({ id: t.id, name: t.name, parent_name: t.parent_name, url: t.url, status: t.status, stage: stage(t), due_date: t.due_date, date_done: t.date_done });
  return ({
    linked: true, user: u, stats: statsFor(tasks, cid, now),
    projects: projectsOf(tasks, now).filter(p => p.assignees.some(a => a.id === cid)).map(p => {
      const mine = p.open.filter(t => t.assignees.some(a => a.id === cid));
      return { id: p.id, name: p.name, url: p.url, due: p.due, total: Math.max(1, p.clips.length), left: (mine.length ? mine : p.open).map(t => ({ name: t.name, stage: stage(t), status: t.status })) };
    }),
    open: currentTasks(tasks, now).current.filter(t => t.assignees.some(a => a.id === cid)).sort((a, b) => (a.due_date || 9e15) - (b.due_date || 9e15)).map(pick),
    done: mine.filter(t => stage(t) === 'done').sort((a, b) => (b.date_done || 0) - (a.date_done || 0)).slice(0, 10).map(pick)
  });
}
