import type { SupabaseClient } from '@supabase/supabase-js';
import { editingTasks, getTask } from './clickup';
import { projectsOf, refLinks, type Project } from './editing';
import { multicast, push } from './line';
import { dueSoonCard, projectAssignedCard, projectCallCard, projectDoneCard } from './line-cards';

// Editing ↔ LINE. ClickUp is the operating system and is only READ here, never written:
//  • new project        → admin announces it on LINE from the dashboard
//  • editor taps "รับ"   → recorded here; the team adds them in ClickUp (dashboard shows who to add)
//  • due within 3 days  → each ClickUp assignee gets one LINE summary per project (clips not sent yet)
//  • past due            → shown on the dashboard; the team decides in ClickUp and may re-announce on LINE
//  • project finished    → thank-you on LINE
// Runs when ClickUp reports a change (webhook).

const DAY = 864e5;

type Editor = { line_user_id: string; full_name: string; display_name: string; clickup_user_id: number };

async function editorsOnLine(db: SupabaseClient): Promise<Editor[]> {
  const { data } = await db.from('line_users').select('line_user_id, full_name, display_name, clickup_user_id')
    .eq('role', 'editor').in('status', ['approved', 'active']).eq('following', true);
  return (data || []) as Editor[];
}

/** Announce one project (ClickUp parent task) to editors on LINE. */
export async function announceProject(db: SupabaseClient, p: Project, o: { detail?: string; rate?: string; reason?: 'new' | 'reassign'; exclude?: string[]; createdBy?: string | null }) {
  const { data: openCall } = await db.from('editing_calls').select('id').eq('clickup_task_id', p.id).eq('status', 'open').maybeSingle();
  if (openCall) return { error: 'โปรเจกต์นี้ประกาศอยู่แล้ว รอคนกดรับ' };
  let description = p.description;
  if (!description) { try { const t = await getTask(p.id); description = (t.text_content || t.description || '').trim(); } catch { /* keep empty */ } }
  const detail = (o.detail ?? description).trim();
  const exclude = new Set(o.exclude || []);
  const to = (await editorsOnLine(db)).map(e => e.line_user_id).filter(id => !exclude.has(id));
  if (!to.length) return { error: 'ยังไม่มีนักตัดต่อที่ผ่านการคัดเลือกใน LINE OA' };
  const { data: call, error } = await db.from('editing_calls').insert({
    clickup_task_id: p.id, task_name: p.name, parent_name: '', due_date: p.due ? new Date(p.due).toISOString() : null,
    detail: detail.slice(0, 600), rate: (o.rate || '').slice(0, 80), sent_to: to.length, created_by: o.createdBy || null,
    reason: o.reason || 'new', exclude_line_user_id: Array.from(exclude).join(',') || null, clips: Math.max(1, p.open.length)
  }).select('id, task_name, due_date, detail, rate, clips, reason').single();
  if (error) return { error: error.message };
  try {
    const msg = projectCallCard({ ...call, refs: refLinks(description), left: p.clips.length ? p.open.map(t => t.name) : [] });
    for (let i = 0; i < to.length; i += 500) await multicast(to.slice(i, i + 500), [msg]);
  } catch (e) {
    await db.from('editing_calls').update({ status: 'cancelled' }).eq('id', call.id);
    return { error: 'ส่ง LINE ไม่สำเร็จ: ' + (e as Error).message.slice(0, 160) };
  }
  return { ok: true, sent: to.length };
}

/** Editor tapped "รับโปรเจกต์นี้": first one wins. Recorded for the team, who add them in ClickUp. */
export async function claimProject(db: SupabaseClient, lineUserId: string, callId: string) {
  const { data: c } = await db.from('editing_calls').select('exclude_line_user_id').eq('id', callId).maybeSingle();
  if (c?.exclude_line_user_id?.split(',').includes(lineUserId)) return { taken: true as const };
  const now = new Date().toISOString();
  const { data: won } = await db.from('editing_calls').update({ status: 'assigned', assigned_line_user_id: lineUserId, assigned_at: now, clickup_assigned: false })
    .eq('id', callId).eq('status', 'open').select('id, clickup_task_id, task_name, due_date, clips').maybeSingle();
  if (!won) return { taken: true as const };
  await db.from('line_messages').insert({ line_user_id: lineUserId, role: 'assistant', content: `[รับโปรเจกต์ตัด] ${won.task_name}` });
  return { taken: false as const, card: projectAssignedCard(won, `https://app.clickup.com/t/${won.clickup_task_id}`, false) };
}

/** Deadline, overdue and finished checks for every current project (or only one). */
export async function runChecks(db: SupabaseClient, onlyProject?: string) {
  const now = Date.now();
  const tasks = await editingTasks();
  const all = projectsOf(tasks, now, true).filter(p => !onlyProject || p.id === onlyProject);
  const editors = await editorsOnLine(db);
  const byCu = new Map(editors.filter(e => e.clickup_user_id).map(e => [Number(e.clickup_user_id), e]));
  const { data: sent } = await db.from('line_reminders').select('line_user_id, clickup_task_id, kind').gte('sent_at', new Date(now - 180 * DAY).toISOString());
  const already = new Set((sent || []).map(r => `${r.line_user_id}|${r.clickup_task_id}|${r.kind}`));
  const log: { line_user_id: string; clickup_task_id: string; kind: string }[] = [];
  const out = { dueSoon: 0, thanked: 0, errors: [] as string[] };
  const once = (e: Editor, key: string, kind: string) => {
    const k = `${e.line_user_id}|${key}|${kind}`;
    if (already.has(k)) return false;
    already.add(k); log.push({ line_user_id: e.line_user_id, clickup_task_id: key, kind }); return true;
  };
  const nameOf = (e: Editor) => e.full_name || e.display_name || '';

  for (const p of all) {
    try {
      if (p.done) {
        if (!p.date_done || now - p.date_done > 2 * DAY) continue;
        const people = new Set<number>();
        for (const t of [...p.clips]) for (const a of t.assignees) people.add(a.id);
        for (const id of people) { const e = byCu.get(id); if (e && once(e, p.id, 'done')) { await push(e.line_user_id, [projectDoneCard(p, nameOf(e))]); out.thanked++; } }
        continue;
      }
      if (!p.due || !p.assignees.length) continue;
      const key = `${p.id}@${p.due}`;
      if (p.due < now) continue; // overdue: shown on the dashboard, the team decides in ClickUp
      if (p.due - now <= 3 * DAY) {
        for (const a of p.assignees) {
          const e = byCu.get(a.id); if (!e) continue;
          const mine = p.open.filter(t => t.assignees.some(x => x.id === a.id));
          if (once(e, key, 'due_soon')) { await push(e.line_user_id, [dueSoonCard({ ...p, open: mine.length ? mine : p.open, total: Math.max(1, p.clips.length) }, nameOf(e))]); out.dueSoon++; }
        }
      }
    } catch (e) { out.errors.push(`${p.name}: ${(e as Error).message.slice(0, 160)}`); }
  }
  if (log.length) await db.from('line_reminders').upsert(log, { onConflict: 'line_user_id,clickup_task_id,kind', ignoreDuplicates: true });
  return out;
}
