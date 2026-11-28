import { NextResponse } from 'next/server';
import { sbAdmin } from '@/lib/supabase/server';
import { getSetting } from '@/lib/settings';
import { push, text } from '@/lib/line';

// Called every minute by Supabase pg_cron (x-cron-key = app_settings.cron_key).
// People who started applying but have not finished get a short nudge:
//  • 5 minutes after the bot asked for a link / "เรียบร้อย" and they went quiet (once per question)
//  • 1, 3 and 5 days after their last message, with their progress
// Each nudge is sent once (line_reminders kind 'nudge').
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR;
type U = { line_user_id: string; display_name: string; full_name: string; role: string | null; status: string; position: string; portfolio_url: string; created_at: string };

function progress(u: U) {
  const tick = (ok: boolean, label: string) => `${ok ? '✅' : '⬜'} ${label}`;
  const steps = [tick(!!u.role, 'เลือกบทบาท')];
  if (u.role === 'crew') steps.push(tick(!!u.full_name, 'ชื่อ'), tick(!!u.position, 'ตำแหน่ง'));
  if (u.role === 'editor') steps.push('📝 กรอกใบสมัคร (Google Form)');
  steps.push(tick(!!u.portfolio_url, 'ลิงก์ผลงาน'), '⬜ พิมพ์ "เรียบร้อย"');
  return steps.join('\n');
}

function nextStep(u: U) {
  if (!u.role) return 'พิมพ์ "เมนู" แล้วเลือกบทบาทได้เลยค่ะ';
  if (u.role === 'crew' && !u.full_name) return 'บอกชื่อ-นามสกุลมาในแชทนี้ได้เลยค่ะ';
  if (u.role === 'crew' && !u.position) return 'บอกตำแหน่งที่ทำในกองถ่ายมาได้เลยค่ะ';
  if (!u.portfolio_url) return 'ส่งลิงก์ผลงานมาในแชทนี้ แล้วพิมพ์ "เรียบร้อย" ค่ะ';
  return 'ส่งครบแล้วพิมพ์ "เรียบร้อย" ได้เลยค่ะ';
}

export async function POST(req: Request) {
  const db = sbAdmin();
  const key = await getSetting(db, 'cron_key');
  if (!key || req.headers.get('x-cron-key') !== key) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const now = Date.now();
  const { data: people } = await db.from('line_users').select('line_user_id, display_name, full_name, role, status, position, portfolio_url, created_at')
    .in('status', ['new', 'applying']).eq('following', true).gte('created_at', new Date(now - 30 * DAY).toISOString());
  if (!people?.length) return NextResponse.json({ ok: true, sent: 0 });
  const ids = people.map(p => p.line_user_id);
  const [{ data: msgs }, { data: sent }] = await Promise.all([
    db.from('line_messages').select('id, line_user_id, role, created_at').in('line_user_id', ids).gte('created_at', new Date(now - 8 * DAY).toISOString()).order('id', { ascending: false }),
    db.from('line_reminders').select('line_user_id, clickup_task_id').eq('kind', 'nudge').in('line_user_id', ids)
  ]);
  const done = new Set((sent || []).map(r => `${r.line_user_id}|${r.clickup_task_id}`));
  let count = 0;

  for (const u of people as U[]) {
    const mine = (msgs || []).filter(m => m.line_user_id === u.line_user_id); // newest first
    const lastUser = mine.find(m => m.role === 'user');
    const last = mine[0];
    const anchorId = lastUser ? String(lastUser.id) : 'follow';
    const anchorAt = lastUser ? +new Date(lastUser.created_at) : +new Date(u.created_at);
    const name = u.full_name || u.display_name || '';
    let keyName = ''; let body = '';

    // 5 minutes: we asked for a link (or "เรียบร้อย") and they went quiet.
    if (u.role && last && last.role === 'assistant' && lastUser && now - +new Date(last.created_at) >= 5 * MIN && now - +new Date(last.created_at) < HOUR) {
      keyName = `5m@${anchorId}`;
      body = u.portfolio_url ? `คุณ${name} ส่งผลงานครบแล้วหรือยังคะ 😊 ถ้าครบแล้วพิมพ์ "เรียบร้อย" ได้เลยค่ะ` : `น้องฮูสยังรอลิงก์ผลงานอยู่นะคะ 😊 ${nextStep(u)}`;
    }
    // 1 / 3 / 5 days after their last message (or after adding us as a friend).
    const age = now - anchorAt;
    if (!keyName) for (const [d, label] of [[5, '5d'], [3, '3d'], [1, '1d']] as const) {
      if (age >= d * DAY && age < (d + 2) * DAY) {
        keyName = `${label}@${anchorId}`;
        body = `คุณ${name} ใบสมัครกับ HOOSE ยังไม่ครบนะคะ 🙏\n${progress(u)}\n${nextStep(u)}`;
        break;
      }
    }
    if (!keyName || done.has(`${u.line_user_id}|${keyName}`)) continue;
    try {
      await push(u.line_user_id, [text(body)]);
      await db.from('line_reminders').insert({ line_user_id: u.line_user_id, clickup_task_id: keyName, kind: 'nudge' });
      await db.from('line_messages').insert({ line_user_id: u.line_user_id, role: 'assistant', content: body });
      count++;
    } catch (e) { console.error('followup', u.line_user_id, (e as Error).message); }
  }
  return NextResponse.json({ ok: true, sent: count });
}
