// ClickUp API (server only). Env: CLICKUP_API_TOKEN (or ClickUpAPIToken) (personal token, ClickUp → Settings → Apps),
// CLICKUP_LIST_IDS (comma-separated; default: (Advanced) · รายชื่อลูกค้า).

const API = 'https://api.clickup.com/api/v2';
export const EDIT_LISTS = (process.env.CLICKUP_LIST_IDS || '901805543973').split(',').map(s => s.trim()).filter(Boolean);
/** Token from Vercel env (either name works). */
const token = () => process.env.CLICKUP_API_TOKEN || process.env.ClickUpAPIToken || '';
export const clickupConfigured = () => !!token();

async function cu(path: string, init: RequestInit = {}) {
  const res = await fetch(API + path, {
    ...init,
    headers: { Authorization: token(), 'Content-Type': 'application/json', ...(init.headers || {}) },
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`ClickUp ${path.split('?')[0]} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

export type CuUser = { id: number; username: string; email: string; profilePicture: string | null };
export type CuTask = {
  id: string; name: string; url: string; parent: string | null; parent_name: string;
  status: string; status_type: string; // open | custom | done | closed
  assignees: CuUser[]; due_date: number | null; date_created: number; date_done: number | null; date_updated: number;
  list: string;
};

type Raw = { id: string; name: string; url: string; parent: string | null; status: { status: string; type: string };
  assignees: CuUser[]; due_date: string | null; date_created: string; date_done: string | null; date_closed: string | null; date_updated: string; list: { name: string } };

/** All tasks (incl. subtasks and closed) of the editing lists. Parent names filled in for subtasks. */
export async function editingTasks(): Promise<CuTask[]> {
  const all: Raw[] = [];
  for (const list of EDIT_LISTS) {
    for (let page = 0; page < 20; page++) {
      const j = await cu(`/list/${list}/task?include_closed=true&subtasks=true&page=${page}`);
      all.push(...(j.tasks || []));
      if (j.last_page !== false && (j.tasks || []).length < 100) break;
    }
  }
  const names = new Map(all.map(t => [t.id, t.name]));
  return all.map(t => ({
    id: t.id, name: (t.name || '').trim(), url: t.url, parent: t.parent, parent_name: t.parent ? (names.get(t.parent) || '').trim() : '',
    status: (t.status?.status || '').trim(), status_type: t.status?.type || 'open',
    assignees: (t.assignees || []).map(a => ({ id: a.id, username: a.username, email: a.email, profilePicture: a.profilePicture })),
    due_date: t.due_date ? Number(t.due_date) : null, date_created: Number(t.date_created), date_done: t.date_done || t.date_closed ? Number(t.date_done || t.date_closed) : null,
    date_updated: Number(t.date_updated), list: t.list?.name || ''
  }));
}

export async function getTask(id: string) {
  return cu(`/task/${encodeURIComponent(id)}`) as Promise<Raw & { description?: string }>;
}

/** Workspace members (editors are guests). */
export async function members(): Promise<CuUser[]> {
  const j = await cu('/team');
  const team = (j.teams || [])[0];
  return (team?.members || []).map((m: { user: CuUser }) => ({ id: m.user.id, username: m.user.username, email: (m.user.email || '').toLowerCase(), profilePicture: m.user.profilePicture }));
}

export async function addAssignee(taskId: string, userId: number) {
  return cu(`/task/${encodeURIComponent(taskId)}`, { method: 'PUT', body: JSON.stringify({ assignees: { add: [userId], rem: [] } }) });
}

/** Status buckets used across the dashboard and reminders. */
export function stage(t: Pick<CuTask, 'status' | 'status_type'>): 'todo' | 'doing' | 'review' | 'done' {
  const s = t.status.toLowerCase();
  if (t.status_type === 'done' || t.status_type === 'closed' || /complete|paid|closed|done/.test(s)) return 'done';
  if (/review|revise/.test(s)) return 'review';
  if (/progress|doing|edit/.test(s)) return 'doing';
  return 'todo';
}

const STALE_DAYS = 60;

/**
 * Current work only: not finished, its parent project not finished, and touched in the last 60 days
 * (or due soon / recently). Older open tasks (tests, templates, abandoned sets) stay in ClickUp but out of the dashboard.
 */
export function currentTasks(tasks: CuTask[], now = Date.now()) {
  const byId = new Map(tasks.map(t => [t.id, t]));
  const isCurrent = (t: CuTask) => {
    if (stage(t) === 'done') return false;
    const parent = t.parent ? byId.get(t.parent) : null;
    if (parent && stage(parent) === 'done') return false;
    const fresh = now - t.date_updated < STALE_DAYS * 864e5;
    const dueNear = !!t.due_date && t.due_date > now - 14 * 864e5;
    return fresh || dueNear;
  };
  const current = tasks.filter(isCurrent);
  const hidden = tasks.filter(t => stage(t) !== 'done' && !isCurrent(t)).length;
  return { current, hidden };
}
