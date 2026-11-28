import type { SupabaseClient } from '@supabase/supabase-js';
import { addAssignee, editingTasks, getTask, removeAssignees } from './clickup';
import { clickupIdFor, projectsOf, refLinks, type Project } from './editing';
import { multicast, push } from './line';
import { dueSoonCard, projectAssignedCard, projectCallCard, projectDoneCard, reassignedCard } from './line-cards';

// Editing automation, run only when something happens (ClickUp webhook) or when an admin presses
// "ตรวจตอนนี้" — no fixed schedule.
//  • due within 3 days  → each assignee gets one summary per project: clips not delivered yet
//  • past due, not done → assignees removed from the open clips in ClickUp, told politely,
//                          and the project is re-announced on LINE to the other editors
//  • project finished    → thank-you to everyone who worked on it

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
    reason: o.reason || 'new', exclude_line_user_id: Array.from(exclude).join(',') || null, clips: Math.max(1, p.clips.length)
  }).select('id, task_name, due_date, detail, rate, clips, reason').single();
  if (error) return { error: error.message };
  try {
    const msg = projectCallCard({ ...call, refs: refLinks(description) });
    for (let i = 0; i < to.length; i += 500) await multicast(to.slice(i, i + 500), [msg]);
  } catch (e) {
    await db.from('editing_calls').update({ status: 'cancelled' }).eq('id', call.id);
    return { error: 'ส่ง LINE ไม่สำเร็จ: ' + (e as Error).message.slice(0, 160) };
  }
  return { ok: true, sent: to.length };
}

/** Editor tapped "รับโปรเจกต์นี้": first one wins; assigned to the project and its open clips in ClickUp. */
export async function claimProject(db: SupabaseClient, lineUserId: string, callId: string) {
  const { data: c } = await db.from('editing_calls').select('exclude_line_user_id').eq('id', callId).maybeSingle();
  if (c?.exclude_line_user_id?.split(',').includes(lineUserId)) return { taken: true as const };
  const now = new Date().toISOString();
  const { data: won } = await db.from('editing_calls').update({ status: 'assigned', assigned_line_user_id: lineUserId, assigned_at: now })
    .eq('id', callId).eq('status', 'open').select('id, clickup_task_id, task_name, due_date, clips').maybeSingle();
  if (!won) return { taken: true as const };
  let inClickUp = false;
  try {
    const cid = await clickupIdFor(db, lineUserId);
    if (cid) {
      const p = projectsOf(await editingTasks(), Date.now(), true).find(x => x.id === won.clickup_task_id);
      const ids = Array.from(new Set([won.clickup_task_id, ...(p?.open || []).map(t => t.id)]));
      for (const id of ids) await addAssignee(id, cid);
      inClickUp = true;
    }
  } catch (e) { console.error('clickup assign', (e as Error).message); }
  await db.from('editing_calls').update({ clickup_assigned: inClickUp }).eq('id', won.id);
  if (!inClickUp) await db.from('line_users').update({ needs_attention: true, attention_at: now,
    attention_note: `รับโปรเจกต์ตัด "${won.task_name}" แล้ว แต่ยัง assign ใน ClickUp ไม่ได้ (ยังไม่ได้ผูกบัญชี ClickUp)` }).eq('line_user_id', lineUserId);
  await db.from('line_messages').insert({ line_user_id: lineUserId, role: 'assistant', content: `[รับโปรเจกต์ตัด] ${won.task_name}` });
  return { taken: false as const, card: projectAssignedCard(won, `https://app.clickup.com/t/${won.clickup_task_id}`, inClickUp) };
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
  // Who took a project after its deadline had passed (a re-announcement): never take it back from them.
  const { data: lateTakers } = await db.from('editing_calls').select('clickup_task_id, assigned_at, due_date').eq('status', 'assigned');
  const takenAfterDue = new Map((lateTakers || []).filter(c => c.assigned_at && (!c.due_date || c.assigned_at > c.due_date))
    .map(c => [c.clickup_task_id, c.due_date ? +new Date(c.due_date) : 0]));
  const log: { line_user_id: string; clickup_task_id: string; kind: string }[] = [];
  const out = { dueSoon: 0, reassigned: 0, thanked: 0, errors: [] as string[] };
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
      // Taken after the deadline had passed: wait until the team sets a new deadline in ClickUp.
      if (p.due < now && takenAfterDue.has(p.id) && p.due <= (takenAfterDue.get(p.id) || 0) + 60e3) continue;
      if (p.due < now) {
        // Overdue: take it back from the current assignees and look for someone else right away.
        const removed = p.assignees.map(a => a.id);
        for (const t of [{ id: p.id, assignees: p.assignees }, ...p.open]) {
          const ids = t.assignees.map(a => a.id).filter(id => removed.includes(id));
          if (ids.length) await removeAssignees(t.id, ids);
        }
        const excluded: string[] = [];
        for (const id of removed) {
          const e = byCu.get(id); if (!e) continue;
          excluded.push(e.line_user_id);
          if (once(e, key, 'overdue')) await push(e.line_user_id, [reassignedCard(p, nameOf(e))]);
        }
        await db.from('editing_calls').update({ status: 'cancelled' }).eq('clickup_task_id', p.id).eq('status', 'open');
        const r = await announceProject(db, p, { reason: 'reassign', exclude: excluded });
        if ('error' in r && r.error) out.errors.push(`${p.name}: ${r.error}`);
        out.reassigned++;
        continue;
      }
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
