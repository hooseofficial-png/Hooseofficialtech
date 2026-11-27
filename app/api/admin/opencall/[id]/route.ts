import { NextResponse } from 'next/server';
import { sbAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin';
import { multicast } from '@/lib/line';
import { openCallCard } from '@/lib/line-cards';
import { positionMatch } from '@/lib/opencall';

// Admin · send one Open Call on LINE: one card per open position, to approved team members
// whose position matches ("match") or to the whole approved team ("all").
export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { audience } = await req.json().catch(() => ({})) as { audience?: 'match' | 'all' };
  const db = sbAdmin();
  const { data: a } = await db.from('announcements').select('id, position_ids, projects(name, brand, type, start_date, end_date, locations, call_time)').eq('id', params.id).maybeSingle();
  if (!a) return NextResponse.json({ error: 'ไม่พบประกาศ' }, { status: 404 });
  const project = a.projects as unknown as Parameters<typeof openCallCard>[0];
  const { data: positions } = await db.from('crew_positions').select('id, position, scope, days, status').in('id', a.position_ids || []).eq('status', 'open');
  const { data: crew } = await db.from('line_users').select('line_user_id, position').in('status', ['approved', 'active']).eq('following', true);
  if (!positions?.length) return NextResponse.json({ error: 'ไม่มีตำแหน่งที่ยังเปิดรับ' }, { status: 400 });

  let sent = 0; const errors: string[] = [];
  for (const p of positions) {
    const to = (crew || []).filter(c => audience === 'all' || positionMatch(p.position, c.position)).map(c => c.line_user_id);
    if (!to.length) continue;
    try { await multicast(to, [openCallCard(project, p, a.id)]); sent += to.length; }
    catch (e) { errors.push(p.position + ': ' + (e as Error).message.slice(0, 120)); }
  }
  await db.from('announcements').update(errors.length && !sent
    ? { status: 'failed', error: errors.join(' | ') }
    : { status: 'sent', sent_at: new Date().toISOString(), error: errors.join(' | ') || null }).eq('id', a.id);
  return NextResponse.json({ ok: !errors.length || sent > 0, sent, errors });
}
