import { NextResponse } from 'next/server';
import { sbAdmin } from '@/lib/supabase/server';
import { clickupConfigured, currentTasks, editingTasks, stage } from '@/lib/clickup';
import { push } from '@/lib/line';
import { reminderCard } from '@/lib/line-cards';

// Daily 09:00 (Asia/Bangkok) via Vercel Cron (vercel.json). Env: CRON_SECRET.
// For every editor linked to ClickUp: not started yet / due in 3 days / overdue / finished.
// Each reminder is sent once per task (line_reminders), all of one person's in a single push.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Kind = 'not_started' | 'due_soon' | 'overdue' | 'done';

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!clickupConfigured()) return NextResponse.json({ skipped: 'CLICKUP_API_TOKEN not set' });
  const db = sbAdmin();
  const [tasks, { data: editors }, { data: sent }] = await Promise.all([
    editingTasks(),
    db.from('line_users').select('line_user_id, full_name, display_name, clickup_user_id').eq('role', 'editor').in('status', ['approved', 'active']).eq('following', true).not('clickup_user_id', 'is', null),
    db.from('line_reminders').select('line_user_id, clickup_task_id, kind').gte('sent_at', new Date(Date.now() - 120 * 864e5).toISOString())
  ]);
  const done = new Set((sent || []).map(r => `${r.line_user_id}|${r.clickup_task_id}|${r.kind}`));
  const now = Date.now(); const day = 864e5;
  const current = new Set(currentTasks(tasks, now).current.map(t => t.id));
  let pushed = 0; const errors: string[] = [];
  for (const e of editors || []) {
    const cu = Number(e.clickup_user_id);
    const due: { kind: Kind; t: typeof tasks[number] }[] = [];
    for (const t of tasks.filter(x => x.assignees.some(a => a.id === cu))) {
      const st = stage(t);
      let kind: Kind | null = null;
      if (st === 'done') { if (t.date_done && now - t.date_done < 2 * day) kind = 'done'; }
      else if (!current.has(t.id)) continue; // old open work: no reminders
      else if (t.due_date && t.due_date < now) kind = 'overdue';
      else if (t.due_date && t.due_date - now < 3 * day && st !== 'review') kind = 'due_soon';
      else if (st === 'todo' && now - t.date_created > day) kind = 'not_started';
      if (kind && !done.has(`${e.line_user_id}|${t.id}|${kind}`)) due.push({ kind, t });
    }
    if (!due.length) continue;
    const name = e.full_name || e.display_name || '';
    const batch = due.slice(0, 5);
    try {
      await push(e.line_user_id, batch.map(x => reminderCard(x.kind, x.t, name)));
      await db.from('line_reminders').upsert(batch.map(x => ({ line_user_id: e.line_user_id, clickup_task_id: x.t.id, kind: x.kind })), { onConflict: 'line_user_id,clickup_task_id,kind', ignoreDuplicates: true });
      pushed += 1;
    } catch (err) { errors.push(`${e.line_user_id}: ${(err as Error).message.slice(0, 120)}`); }
  }
  return NextResponse.json({ ok: true, pushed, errors });
}
