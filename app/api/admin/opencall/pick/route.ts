import { NextResponse } from 'next/server';
import { sbAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin';
import { push, splitReply, text } from '@/lib/line';
import { partyCodeCard, projectBrief } from '@/lib/line-cards';

// Admin · pick one person who accepted an Open Call: confirm the crew position in the project
// and send them the party code + project brief on LINE.
export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { position_id, line_user_id } = await req.json().catch(() => ({})) as { position_id?: string; line_user_id?: string };
  if (!position_id || !line_user_id) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  const db = sbAdmin();
  const { data: r } = await db.from('open_call_responses').select('id, answer').eq('position_id', position_id).eq('line_user_id', line_user_id).maybeSingle();
  if (!r || r.answer !== 'accept') return NextResponse.json({ error: 'คนนี้ไม่ได้กดรับงาน' }, { status: 400 });
  const { data: pos } = await db.from('crew_positions')
    .select('id, position, status, projects(name, brand, type, start_date, end_date, locations, call_time, synopsis, deliverables, pm_name, pm_phone, special, party_code)')
    .eq('id', position_id).maybeSingle();
  if (!pos) return NextResponse.json({ error: 'ไม่พบตำแหน่ง' }, { status: 404 });
  if (pos.status === 'confirmed') return NextResponse.json({ error: 'ตำแหน่งนี้ยืนยันคนแล้ว' }, { status: 409 });
  const { data: lu } = await db.from('line_users').select('full_name, display_name, phone').eq('line_user_id', line_user_id).maybeSingle();

  const now = new Date().toISOString();
  await db.from('crew_positions').update({ status: 'confirmed', name: lu?.full_name || lu?.display_name || '', phone: lu?.phone || '' }).eq('id', position_id);
  await db.from('open_call_responses').update({ selected_at: now }).eq('id', r.id);

  const p = pos.projects as unknown as Parameters<typeof partyCodeCard>[0] & Parameters<typeof projectBrief>[0];
  let sendError = '';
  try {
    await push(line_user_id, [partyCodeCard(p, pos.position), ...splitReply(projectBrief(p), 300).map(t => text(t))]);
    await db.from('open_call_responses').update({ notified_at: now }).eq('id', r.id);
    await db.from('line_messages').insert({ line_user_id, role: 'assistant', content: `[ยืนยันงาน] ${pos.position} · ${p.name} · Party Code ${p.party_code || '-'}` });
  } catch (e) { sendError = (e as Error).message; }
  return NextResponse.json({ ok: true, sendError });
}
