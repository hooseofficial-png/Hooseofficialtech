import { NextResponse } from 'next/server';
import { sbAdmin } from '@/lib/supabase/server';
import { getSetting } from '@/lib/settings';
import { push, text } from '@/lib/line';

// Called every minute by Supabase pg_cron (x-cron-key = app_settings.cron_key).
// People who started applying but have not finished get a short nudge:
//  • 10 minutes after the bot asked them to do a step and they went quiet: ask once more
//    (portfolio link, book the interview, read documents + data form, create the HOOSE account),
//    always ending with: เสร็จแล้วพิมพ์ "เสร็จสิ้น"
//  • 1, 3 and 5 days after their last message, with their progress (applicants only)
// Each nudge is sent once (line_reminders kind 'nudge'); a nudge never triggers another nudge.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR;
type U = { line_user_id: string; display_name: string; full_name: string; role: string | null; status: string; position: string; portfolio_url: string; created_at: string; profile_id: string | null; interview_booked_at: string | null };

function progress(u: U) {
  const tick = (ok: boolean, label: string) => `${ok ? '✅' : '⬜'} ${label}`;
  const steps = [tick(!!u.role, 'เลือกบทบาท')];
  if (u.role === 'crew') steps.push(tick(!!u.full_name, 'ชื่อ'), tick(!!u.position, 'ตำแหน่ง'));
  if (u.role === 'editor') steps.push('📝 กรอกใบสมัคร (Google Form)');
  steps.push(tick(!!u.portfolio_url, 'ลิงก์ผลงาน'), '⬜ พิมพ์ "เสร็จสิ้น"');
  return steps.join('\n');
}

function nextStep(u: U) {
  if (!u.role) return 'พิมพ์ "เมนู" แล้วเลือกบทบาทได้เลยค่ะ';
  if (u.role === 'crew' && !u.full_name) return 'บอกชื่อ-นามสกุลมาในแชทนี้ได้เลยค่ะ';
  if (u.role === 'crew' && !u.position) return 'บอกตำแหน่งที่ทำในกองถ่ายมาได้เลยค่ะ';
  if (!u.portfolio_url) return 'ส่งลิงก์ผลงานมาในแชทนี้ แล้วพิมพ์ "เสร็จสิ้น" ค่ะ';
  return 'ส่งครบแล้วพิมพ์ "เสร็จสิ้น" ได้เลยค่ะ';
}

/** The re-ask sent 10 minutes after the bot's last request, or '' when nothing is waiting on them. */
function reAsk(u: U, name: string) {
  const who = name ? `คุณ${name} ` : '';
  if (['new', 'applying'].includes(u.status)) {
    if (!u.role) return '';
    return u.portfolio_url ? `${who}ส่งผลงานครบแล้วหรือยังคะ 😊 ถ้าครบแล้วพิมพ์ "เสร็จสิ้น" ในแชทนี้ได้เลยค่ะ` : `น้องฮูสยังรออยู่นะคะ 😊 ${nextStep(u)}`;
  }
  if (u.status === 'interview' && !u.interview_booked_at) return `${who}เลือกเวลานัดคุยกับทีมได้หรือยังคะ 🗓️ กดปุ่ม "เลือกเวลานัดคุย" ในการ์ดด้านบน นัดเสร็จแล้วพิมพ์ "เสร็จสิ้น" ในแชทนี้นะคะ`;
  if (u.status === 'onboarding') return `${who}อ่านเอกสารและกรอกแบบฟอร์มข้อมูลเรียบร้อยหรือยังคะ 📄 เสร็จแล้วพิมพ์ "เสร็จสิ้น" ในแชทนี้นะคะ`;
  if (u.status === 'approved' && !u.profile_id) return `${who}สร้างบัญชี HOOSE ได้หรือยังคะ ✨ กดปุ่ม "สร้างบัญชี / เข้าสู่ระบบ HOOSE" ในการ์ดด้านบน เสร็จแล้วพิมพ์ "เสร็จสิ้น" ในแชทนี้นะคะ`;
  return '';
}

export async function POST(req: Request) {
  const db = sbAdmin();
  const key = await getSetting(db, 'cron_key');
  if (!key || req.headers.get('x-cron-key') !== key) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const now = Date.now();
  const { data: people } = await db.from('line_users').select('line_user_id, display_name, full_name, role, status, position, portfolio_url, created_at, profile_id, interview_booked_at')
    .in('status', ['new', 'applying', 'interview', 'onboarding', 'approved']).eq('following', true).gte('created_at', new Date(now - 60 * DAY).toISOString());
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

    // 10 minutes: the bot's last message asked them to do something and they have not answered.
    if (last && last.role === 'assistant' && now - +new Date(last.created_at) >= 10 * MIN && now - +new Date(last.created_at) < HOUR) {
      const k = `10m@${last.id}`;
      const b = reAsk(u, name);
      if (b && !done.has(`${u.line_user_id}|${k}`)) { keyName = k; body = b; }
    }
    // 1 / 3 / 5 days after their last message (or after adding us as a friend).
    const age = now - anchorAt;
    if (!keyName && ['new', 'applying'].includes(u.status)) for (const [d, label] of [[5, '5d'], [3, '3d'], [1, '1d']] as const) {
      if (age >= d * DAY && age < (d + 2) * DAY) {
        keyName = `${label}@${anchorId}`;
        body = `คุณ${name} ใบสมัครกับ HOOSE ยังไม่ครบนะคะ 🙏\n${progress(u)}\n${nextStep(u)}`;
        break;
      }
    }
    if (!keyName || done.has(`${u.line_user_id}|${keyName}`)) continue;
    try {
      await push(u.line_user_id, [text(body)]);
      const { data: row } = await db.from('line_messages').insert({ line_user_id: u.line_user_id, role: 'assistant', content: body }).select('id').single();
      // Mark both the question and the nudge itself as handled, so a nudge never triggers another nudge.
      await db.from('line_reminders').insert([
        { line_user_id: u.line_user_id, clickup_task_id: keyName, kind: 'nudge' },
        ...(row ? [{ line_user_id: u.line_user_id, clickup_task_id: `10m@${row.id}`, kind: 'nudge' }] : [])
      ]);
      count++;
    } catch (e) { console.error('followup', u.line_user_id, (e as Error).message); }
  }
  return NextResponse.json({ ok: true, sent: count });
}
