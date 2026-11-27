import { NextResponse } from 'next/server';
import { sbAdmin } from '@/lib/supabase/server';
import { verifyIdToken } from '@/lib/line';
import { clickupConfigured, currentTasks, editingTasks, stage } from '@/lib/clickup';
import { clickupIdFor, statsFor } from '@/lib/editing';

// LIFF "งานของฉัน" for editors: their ClickUp tasks and performance, proven by the LINE ID token.
export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  const { idToken } = await req.json().catch(() => ({})) as { idToken?: string };
  const who = await verifyIdToken(idToken || '');
  if (!who) return NextResponse.json({ error: 'ยืนยันตัวตน LINE ไม่สำเร็จ ปิดหน้านี้แล้วเปิดใหม่จากแชท' }, { status: 401 });
  const db = sbAdmin();
  const { data: u } = await db.from('line_users').select('full_name, display_name, picture_url, role, status').eq('line_user_id', who.sub).maybeSingle();
  if (!u || !['approved', 'active'].includes(u.status)) return NextResponse.json({ linked: false, reason: 'not_member', user: u });
  if (!clickupConfigured()) return NextResponse.json({ linked: false, reason: 'no_clickup', user: u });
  const cid = await clickupIdFor(db, who.sub);
  if (!cid) return NextResponse.json({ linked: false, reason: 'no_account', user: u });
  const tasks = await editingTasks();
  const mine = tasks.filter(t => t.assignees.some(a => a.id === cid));
  const now = Date.now();
  const pick = (t: typeof mine[number]) => ({ id: t.id, name: t.name, parent_name: t.parent_name, url: t.url, status: t.status, stage: stage(t), due_date: t.due_date, date_done: t.date_done });
  return NextResponse.json({
    linked: true, user: u, stats: statsFor(tasks, cid, now),
    open: currentTasks(tasks, now).current.filter(t => t.assignees.some(a => a.id === cid)).sort((a, b) => (a.due_date || 9e15) - (b.due_date || 9e15)).map(pick),
    done: mine.filter(t => stage(t) === 'done').sort((a, b) => (b.date_done || 0) - (a.date_done || 0)).slice(0, 10).map(pick)
  });
}
