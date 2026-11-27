import { NextResponse } from 'next/server';
import { sbAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin';
import { getTask } from '@/lib/clickup';
import { multicast } from '@/lib/line';
import { editingCallCard } from '@/lib/line-cards';

// Admin · announce one ClickUp task to approved editors on LINE. First to tap "รับงานนี้" gets it.
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json().catch(() => ({})) as { task_id?: string; detail?: string; rate?: string };
  if (!b.task_id) return NextResponse.json({ error: 'เลือกงานก่อน' }, { status: 400 });
  const db = sbAdmin();
  const { data: openCall } = await db.from('editing_calls').select('id').eq('clickup_task_id', b.task_id).eq('status', 'open').maybeSingle();
  if (openCall) return NextResponse.json({ error: 'งานนี้ประกาศอยู่แล้ว รอคนกดรับ' }, { status: 409 });
  const t = await getTask(b.task_id);
  if (t.assignees?.length) return NextResponse.json({ error: 'งานนี้มีคนตัดแล้วใน ClickUp' }, { status: 409 });
  let parent = '';
  if (t.parent) { try { parent = (await getTask(t.parent)).name; } catch { /* no parent name */ } }
  const { data: editors } = await db.from('line_users').select('line_user_id').eq('role', 'editor').in('status', ['approved', 'active']).eq('following', true);
  const to = (editors || []).map(e => e.line_user_id);
  if (!to.length) return NextResponse.json({ error: 'ยังไม่มีนักตัดต่อที่ผ่านการคัดเลือกใน LINE OA' }, { status: 400 });
  const { data: call, error } = await db.from('editing_calls').insert({
    clickup_task_id: t.id, task_name: (t.name || '').trim(), parent_name: (parent || '').trim(),
    due_date: t.due_date ? new Date(Number(t.due_date)).toISOString() : null,
    detail: (b.detail || '').slice(0, 600), rate: (b.rate || '').slice(0, 80), sent_to: to.length, created_by: admin
  }).select('id, task_name, parent_name, due_date, detail, rate').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  try { for (let i = 0; i < to.length; i += 500) await multicast(to.slice(i, i + 500), [editingCallCard(call)]); }
  catch (e) {
    await db.from('editing_calls').update({ status: 'cancelled' }).eq('id', call.id);
    return NextResponse.json({ error: 'ส่ง LINE ไม่สำเร็จ: ' + (e as Error).message.slice(0, 160) }, { status: 502 });
  }
  return NextResponse.json({ ok: true, sent: to.length });
}

/** Cancel an open call (nobody can take it any more). */
export async function DELETE(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id') || '';
  await sbAdmin().from('editing_calls').update({ status: 'cancelled' }).eq('id', id).eq('status', 'open');
  return NextResponse.json({ ok: true });
}
