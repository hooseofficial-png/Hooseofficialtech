import { NextResponse } from 'next/server';
import { sbAdmin } from '@/lib/supabase/server';
import { getProfile, lineConfigured, reply, signLink, splitReply, startLoading, text, verifySignature, type LineMessage } from '@/lib/line';
import { ACCOUNT_DONE_TEXTS, DONE_RE, DONE_TEXTS, FINISH_HINT, nextStepCard, resultCard, statusCard, welcomeCard, withQuickMenu } from '@/lib/line-cards';
import { claimProject } from '@/lib/editing-engine';
import { answer, isMember, sorryFor, type LineUser } from '@/lib/line-agent';

// HOOSE Official LINE OA webhook.
// LINE Developers → Messaging API → Webhook URL: https://app.hooseofficial.site/api/line/webhook
//  follow          → save the person, send the welcome card (3 role buttons)
//  postback role   → save the role, send the next recruiting step
//  postback oc     → Open Call answer (accept / decline) saved to open_call_responses
//  text message    → "เมนู" welcome card · "สมัคร" next application step · applicants still applying are
//                    walked through name → position → best work without AI · everything else goes to the AI
//                    (typing dots; long answers split into 2 bubbles)
// Always answers 200 so LINE does not retry; failures are logged.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type LineEvent = {
  type: string; replyToken?: string;
  source?: { type: string; userId?: string };
  message?: { type: string; text?: string };
  postback?: { data?: string };
};

const MENU = /^(เมนู|menu|เริ่มใหม่|start)$/i;
const USER_COLS = 'line_user_id, display_name, full_name, role, status, position, portfolio_url, memory, survey, survey_done_at, profile_id, interview_booked_at';
const APPLY = /^(สมัคร|ใบสมัคร|apply|liff|ฟอร์ม|ฟอร์มสมัคร)$/i;
const STATUS = /^(สถานะ|สถานะของฉัน|สถานะงาน|status|เช็กสถานะ|เช็คสถานะ)$/i;
const URL_RE = /https?:\/\/[^\s]+/i;
const FORM_DONE = DONE_RE;
const DONE_WORD = DONE_RE;
/** "นัดมีทติ้งเรียบร้อย", "จองเวลาแล้ว" … after the interview card. */
const BOOKED = /(นัด|จอง|เลือกเวลา|มีท|meeting|calendly).*(แล้ว|เรียบร้อย|เสร็จ|done)/i;
const QUESTION = /[?？]|ไหม|มั้ย|อะไร|ยังไง|อย่างไร|เท่าไหร่|เท่าไร|ทำไม|เมื่อไหร่|กี่/;

export async function POST(req: Request) {
  const raw = await req.text();
  if (!lineConfigured()) return NextResponse.json({ error: 'LINE is not configured' }, { status: 503 });
  if (!verifySignature(raw, req.headers.get('x-line-signature'))) return NextResponse.json({ error: 'bad signature' }, { status: 401 });

  let events: LineEvent[] = [];
  try { events = JSON.parse(raw).events || []; } catch { return NextResponse.json({ ok: true }); }

  const db = sbAdmin();
  for (const ev of events) {
    try { await handle(db, ev); } catch (e) { console.error('line event failed', ev.type, (e as Error).message); }
  }
  return NextResponse.json({ ok: true });
}

async function upsertUser(db: ReturnType<typeof sbAdmin>, userId: string, following = true): Promise<LineUser> {
  const { data: found } = await db.from('line_users').select(USER_COLS).eq('line_user_id', userId).maybeSingle();
  if (found) {
    await db.from('line_users').update({ last_seen_at: new Date().toISOString(), following }).eq('line_user_id', userId);
    return found as LineUser;
  }
  const p = await getProfile(userId);
  const { data, error } = await db.from('line_users')
    .upsert({ line_user_id: userId, display_name: p?.displayName || '', picture_url: p?.pictureUrl || '', following }, { onConflict: 'line_user_id' })
    .select(USER_COLS).single();
  if (error) throw error;
  return data as LineUser;
}

async function handle(db: ReturnType<typeof sbAdmin>, ev: LineEvent) {
  const userId = ev.source?.userId;
  if (!userId || ev.source?.type !== 'user') return; // groups come in a later stage

  if (ev.type === 'unfollow') { await db.from('line_users').update({ following: false }).eq('line_user_id', userId); return; }

  const u = await upsertUser(db, userId);
  if (!ev.replyToken) return;

  if (ev.type === 'follow') { await reply(ev.replyToken, [welcomeCard(u.display_name)]); return; }

  if (ev.type === 'postback') {
    const q = new URLSearchParams(ev.postback?.data || '');
    if (q.get('action') === 'role' && ['editor', 'crew', 'manager'].includes(q.get('v') || '')) {
      const role = q.get('v')!;
      const status = ['new', 'applying'].includes(u.status) ? 'applying' : u.status;
      await db.from('line_users').update({ role, status }).eq('line_user_id', userId);
      const nu = { ...u, role, status };
      const first = role === 'crew' && ['new', 'applying'].includes(status) ? text(crewPrompt(nu)) : nextStepCard(role);
      await reply(ev.replyToken, [first]);
    }
    if (q.get('action') === 'oc') await openCallAnswer(db, u, q, ev.replyToken);
    if (q.get('action') === 'ed') await claimEditing(db, u, q.get('c') || '', ev.replyToken);
    return;
  }

  if (ev.type === 'message') {
    if (ev.message?.type !== 'text') { await reply(ev.replyToken, [text(isMember(u) ? 'น้องฮูสอ่านได้เฉพาะข้อความนะคะ 😊 ส่งเป็นลิงก์หรือพิมพ์มาได้เลยค่ะ' : 'รับได้เฉพาะข้อความค่ะ กรุณาส่งผลงานเป็นลิงก์ (Google Drive, YouTube, Vimeo หรือ Portfolio)')]); return; }
    const msg = (ev.message.text || '').trim();
    const quick = (m: LineMessage) => withQuickMenu(m, u);
    if (MENU.test(msg)) { await reply(ev.replyToken, [welcomeCard(u.display_name)]); return; }
    if (APPLY.test(msg)) { await reply(ev.replyToken, [u.role === 'crew' && ['new', 'applying'].includes(u.status) ? text(crewPrompt(u)) : u.role ? nextStepCard(u.role) : welcomeCard(u.display_name)]); return; }
    if (STATUS.test(msg) && ['approved', 'active'].includes(u.status)) { await reply(ev.replyToken, [quick(statusCard(u))]); return; }
    // Typed "รับงานนี้": take the newest Open Call still open for this editor.
    if (/^รับงาน(นี้)?\s*(ค่ะ|ครับ|คะ|นะคะ)?[!！.]*$/.test(msg) && u.role === 'editor') {
      const { data: calls } = await db.from('editing_calls').select('id, exclude_line_user_id').eq('status', 'open')
        .gte('created_at', new Date(Date.now() - 14 * 864e5).toISOString()).order('created_at', { ascending: false }).limit(10);
      const c = (calls || []).find(x => !(x.exclude_line_user_id || '').split(',').includes(userId));
      if (c) { await claimEditing(db, u, c.id, ev.replyToken); return; }
      await reply(ev.replyToken, [text('ตอนนี้ยังไม่มีงานที่เปิดรับอยู่ค่ะ 🙏 มีงานใหม่เมื่อไหร่ น้องฮูสจะส่งมาให้ก่อนเลยนะคะ')]);
      return;
    }

    // Interview: they booked a time on the card → "เสร็จสิ้น".
    if (u.status === 'interview' && (DONE_WORD.test(msg) || BOOKED.test(msg))) {
      const now = new Date().toISOString(); const name = u.full_name || u.display_name || '';
      await db.from('line_users').update({ interview_booked_at: now, needs_attention: true, attention_note: 'แจ้งว่านัดเวลาคุยแล้ว', attention_at: now }).eq('line_user_id', userId);
      const out = [`รับทราบการนัดหมายของคุณ${name} แล้วค่ะ หลังคุยกับทีม เอกสารและแบบฟอร์มข้อมูลจะส่งมาในแชทนี้ค่ะ`];
      await db.from('line_messages').insert([{ line_user_id: userId, role: 'user', content: msg }, { line_user_id: userId, role: 'assistant', content: out.join('\n') }]);
      await reply(ev.replyToken, out.map(t => text(t)));
      return;
    }
    // Account step: they say they're done; check the link actually happened.
    if (u.status === 'approved' && DONE_WORD.test(msg)) {
      const name = u.full_name || u.display_name || '';
      const out = u.profile_id
        ? [resultCard('active', u.role, ACCOUNT_DONE_TEXTS.join(' '))!]
        : [text(`ยังไม่พบบัญชี HOOSE ที่ผูกกับ LINE ของคุณ${name} ค่ะ กรุณากดปุ่มด้านล่างเพื่อสร้างบัญชีหรือเข้าสู่ระบบ แล้วพิมพ์ "เสร็จสิ้น" อีกครั้งค่ะ`),
           resultCard('approved', u.role, 'สร้างบัญชี / เข้าสู่ระบบ HOOSE', '', signLink(userId))!];
      await db.from('line_messages').insert([{ line_user_id: userId, role: 'user', content: msg }, { line_user_id: userId, role: 'assistant', content: u.profile_id ? '[บัญชีพร้อมแล้ว]' : '[ส่งลิงก์สร้างบัญชีอีกครั้ง]' }]);
      await reply(ev.replyToken, out);
      return;
    }

    // Onboarding: documents read + data form sent → "เสร็จสิ้น" → create a HOOSE account.
    if (u.status === 'onboarding' && FORM_DONE.test(msg)) {
      const now = new Date().toISOString();
      await db.from('line_users').update({ status: 'approved', status_changed_at: now }).eq('line_user_id', userId);
      const name = u.full_name || u.display_name || '';
      const c = resultCard('approved', u.role, `ได้รับข้อมูลของคุณ${name} ครบถ้วนแล้วค่ะ`, '', signLink(userId))!;
      await db.from('line_messages').insert([{ line_user_id: userId, role: 'user', content: msg }, { line_user_id: userId, role: 'assistant', content: '[สร้างบัญชี HOOSE] ส่งลิงก์สร้างบัญชีแล้ว' }]);
      await reply(ev.replyToken, [c]);
      return;
    }

    // Application intake: fixed steps, no AI needed.
    const out = await intake(db, u, msg);
    if (out) {
      await db.from('line_messages').insert([{ line_user_id: userId, role: 'user', content: msg.slice(0, 4000) }, { line_user_id: userId, role: 'assistant', content: out.join('\n') }]);
      await reply(ev.replyToken, out.map(t => text(t)));
      return;
    }

    await startLoading(userId, 30);
    let ans: { text: string; card: string | null } = { text: sorryFor(u), card: null };
    try { ans = await answer(db, u, msg); }
    catch (e) {
      // Logged for the team (Vercel logs + admin page); the user only sees a friendly line.
      const why = (e as Error).message;
      console.error('line agent failed', why);
      await db.from('line_users').update({ needs_attention: true, attention_note: 'ผู้ช่วยตอบไม่ได้: ' + why.slice(0, 300), attention_at: new Date().toISOString() }).eq('line_user_id', userId);
    }
    const msgs: LineMessage[] = splitReply(ans.text).map(t => text(t));
    if (ans.card === 'form' && u.role === 'editor') msgs.push(nextStepCard('editor'));
    if (ans.card === 'status' && ['approved', 'active'].includes(u.status)) msgs.push(statusCard(u));
    msgs[msgs.length - 1] = quick(msgs[msgs.length - 1]);
    await reply(ev.replyToken, msgs);
  }
}

const BEST_WORK_CREW = 'กรุณาส่งลิงก์ผลงานในกองถ่ายที่ดีที่สุดของคุณ (Google Drive, YouTube, Vimeo หรือ Portfolio) ค่ะ ' + FINISH_HINT;
const BEST_WORK_EDITOR = 'กรุณาส่งลิงก์ผลงานตัดต่อที่ดีที่สุดของคุณ (Google Drive, YouTube, Vimeo หรือ Portfolio) ค่ะ ' + FINISH_HINT;

/** What to ask a crew applicant next (never asks again for something already given). */
function crewPrompt(u: LineUser) {
  if (!u.full_name) return 'กรุณาพิมพ์ชื่อ-นามสกุลของคุณค่ะ';
  if (!u.position) return `ขอบคุณค่ะคุณ${u.full_name} กรุณาพิมพ์ตำแหน่งที่คุณทำในกองถ่าย (เช่น Camera Assistant, Gaffer, Art, PA) ค่ะ`;
  if (!u.portfolio_url) return BEST_WORK_CREW;
  return 'ได้รับลิงก์แล้วค่ะ ' + FINISH_HINT;
}

/**
 * Applicants still applying: editors finish by sending their best work; crew answer name → position → best work.
 * Returns the reply bubbles, or null to let the AI answer (questions and small talk).
 */
async function intake(db: ReturnType<typeof sbAdmin>, u: LineUser, msg: string): Promise<string[] | null> {
  if (!['editor', 'crew'].includes(u.role || '') || !['new', 'applying'].includes(u.status)) return null;
  const ready = (x: LineUser) => !!x.portfolio_url && (u.role === 'editor' || (!!x.full_name && !!x.position));

  // "เสร็จสิ้น" (or เรียบร้อย): the applicant says they have sent everything.
  if (DONE_WORD.test(msg)) {
    if (!ready(u)) return [u.role === 'crew' ? crewPrompt(u) : 'ยังไม่ได้รับลิงก์ผลงานค่ะ กรุณาส่งลิงก์ก่อน แล้วพิมพ์ "เสร็จสิ้น" อีกครั้งค่ะ'];
    const now = new Date().toISOString();
    await db.from('line_users').update({ status: 'applied', applied_at: now, status_changed_at: now }).eq('line_user_id', u.line_user_id);
    u.status = 'applied';
    return DONE_TEXTS;
  }

  const url = msg.match(URL_RE)?.[0].replace(/[)\]>"']+$/, '') || '';
  const patch: Record<string, string> = {};
  if (url) { if (!u.portfolio_url) patch.portfolio_url = url.slice(0, 500); }
  else if (QUESTION.test(msg)) return null;
  else if (u.role === 'crew' && !u.full_name && msg.length <= 60) patch.full_name = msg.replace(/^(ชื่อ|ผม|ฉัน|ดิฉัน|หนู)\s*/, '').trim();
  else if (u.role === 'crew' && u.full_name && !u.position && msg.length <= 120) patch.position = msg.replace(/^(ได้หมด(เลย)?(ครับ|ค่ะ)?\s*)?(ส่วนใหญ่|ปกติ|หลัก ๆ)?\s*(ทำ|เป็น)?\s*/, '').trim() || msg;
  else return null;

  const next = { ...u, ...patch } as LineUser;
  if (Object.keys(patch).length || u.status === 'new') await db.from('line_users').update({ ...patch, status: 'applying' }).eq('line_user_id', u.line_user_id);
  Object.assign(u, patch);
  if (url && ready(next)) return [u.portfolio_url && !patch.portfolio_url
    ? 'ได้รับลิงก์เพิ่มแล้วค่ะ ' + FINISH_HINT
    : 'ได้รับลิงก์ผลงานแล้วค่ะ ส่งเพิ่มได้ เมื่อครบแล้วกรุณาพิมพ์ "เสร็จสิ้น" ค่ะ'];
  if (u.role === 'crew') return [crewPrompt(next)];
  return [BEST_WORK_EDITOR];
}

/** Open Call button: save the answer. The HOOSE team confirms from the dashboard, then the party code is sent. */
async function openCallAnswer(db: ReturnType<typeof sbAdmin>, u: LineUser, q: URLSearchParams, replyToken: string) {
  const pos = q.get('pos') || ''; const ann = q.get('ann') || ''; const a = q.get('a') === 'accept' ? 'accept' : 'decline';
  if (!/^[0-9a-f-]{36}$/.test(pos) || !/^[0-9a-f-]{36}$/.test(ann)) return;
  const { data: cp } = await db.from('crew_positions').select('status, position').eq('id', pos).maybeSingle();
  if (!cp) { await reply(replyToken, [text('ประกาศนี้ปิดไปแล้วค่ะ 🙏 มีงานใหม่เมื่อไหร่ น้องฮูสจะส่งมาให้ทันทีนะคะ')]); return; }
  if (a === 'accept' && cp.status !== 'open') { await reply(replyToken, [text(`ตำแหน่ง ${cp.position} ได้คนครบแล้วค่ะ 🙏 ขอบคุณที่สนใจมาก ๆ นะคะ งานหน้าจะรีบส่งมาให้เลยค่ะ`)]); return; }
  await db.from('open_call_responses').upsert({ announcement_id: ann, position_id: pos, line_user_id: u.line_user_id, answer: a }, { onConflict: 'position_id,line_user_id' });
  await reply(replyToken, [text(a === 'accept'
    ? `รับทราบค่ะ ✋ ส่งชื่อคุณให้ทีมงานพิจารณาตำแหน่ง ${cp.position} แล้วนะคะ ถ้าได้รับเลือก น้องฮูสจะส่ง Party Code และรายละเอียดกองถ่ายให้ทันทีค่ะ 💙`
    : 'ไม่เป็นไรเลยค่ะ 😊 ขอบคุณที่แจ้งนะคะ งานหน้าจะส่งมาให้อีกค่ะ')]);
}

/** Editing project: the first approved editor to tap gets it (assigned in ClickUp to the project and its open clips). */
async function claimEditing(db: ReturnType<typeof sbAdmin>, u: LineUser, callId: string, replyToken: string) {
  if (!/^[0-9a-f-]{36}$/.test(callId)) return;
  if (!['approved', 'active'].includes(u.status) || u.role !== 'editor') { await reply(replyToken, [text('โปรเจกต์นี้สำหรับทีมตัดต่อ HOOSE ที่ผ่านการคัดเลือกแล้วนะคะ 🙏')]); return; }
  const r = await claimProject(db, u.line_user_id, callId);
  if (r.taken) { await reply(replyToken, [text('โปรเจกต์นี้มีคนรับไปแล้วค่ะ 🙏 ขอบคุณที่ไวมากนะคะ โปรเจกต์หน้าน้องฮูสจะรีบส่งมาให้เลยค่ะ ✨')]); return; }
  await reply(replyToken, [r.card]);
}
