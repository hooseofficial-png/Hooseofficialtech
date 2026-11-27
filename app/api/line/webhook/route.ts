import { NextResponse } from 'next/server';
import { sbAdmin } from '@/lib/supabase/server';
import { getProfile, lineConfigured, reply, splitReply, startLoading, text, verifySignature, type LineMessage } from '@/lib/line';
import { DONE_TEXTS, nextStepCard, statusCard, welcomeCard, withQuickMenu } from '@/lib/line-cards';
import { answer, SORRY, type LineUser } from '@/lib/line-agent';

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
const USER_COLS = 'line_user_id, display_name, full_name, role, status, position, portfolio_url, memory, survey, survey_done_at, profile_id';
const APPLY = /^(สมัคร|ใบสมัคร|apply|liff|ฟอร์ม|ฟอร์มสมัคร)$/i;
const STATUS = /^(สถานะ|สถานะของฉัน|สถานะงาน|status|เช็กสถานะ|เช็คสถานะ)$/i;
const URL_RE = /https?:\/\/[^\s]+/i;
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
    return;
  }

  if (ev.type === 'message') {
    if (ev.message?.type !== 'text') { await reply(ev.replyToken, [text('น้องฮูสอ่านได้เฉพาะข้อความนะคะ 😊 ถ้าจะส่งผลงาน ส่งเป็นลิงก์ (Google Drive, YouTube, Vimeo หรือ Portfolio) มาได้เลยค่ะ')]); return; }
    const msg = (ev.message.text || '').trim();
    const quick = (m: LineMessage) => withQuickMenu(m, u);
    if (MENU.test(msg)) { await reply(ev.replyToken, [welcomeCard(u.display_name)]); return; }
    if (APPLY.test(msg)) { await reply(ev.replyToken, [u.role === 'crew' && ['new', 'applying'].includes(u.status) ? text(crewPrompt(u)) : u.role ? nextStepCard(u.role) : welcomeCard(u.display_name)]); return; }
    if (STATUS.test(msg) && ['approved', 'active'].includes(u.status)) { await reply(ev.replyToken, [quick(statusCard(u))]); return; }

    // Application intake: fixed steps, no AI needed.
    const out = await intake(db, u, msg);
    if (out) {
      await db.from('line_messages').insert([{ line_user_id: userId, role: 'user', content: msg.slice(0, 4000) }, { line_user_id: userId, role: 'assistant', content: out.join('\n') }]);
      await reply(ev.replyToken, out.map(t => text(t)));
      return;
    }

    await startLoading(userId, 30);
    let ans: { text: string; card: string | null } = { text: SORRY, card: null };
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

const BEST_WORK_CREW = 'ขอดูผลงานในกองถ่ายที่คุณชอบที่สุด 1 ชิ้นค่ะ 🎬 ส่งลิงก์มาได้เลย (Google Drive, YouTube, Vimeo หรือ Portfolio) ถ้าเล่าสั้น ๆ ด้วยว่าทำหน้าที่อะไรในงานนั้น จะยิ่งดีเลยค่ะ';
const BEST_WORK_EDITOR = 'ขอดูผลงานที่คุณคิดว่าตัดออกมาดีที่สุด 1 ชิ้นค่ะ ✨ ส่งลิงก์มาได้เลย (Google Drive, YouTube, Vimeo หรือ Portfolio)';

/** What to ask a crew applicant next (never asks again for something already given). */
function crewPrompt(u: LineUser) {
  if (!u.full_name) return 'ยินดีต้อนรับทีมโปรดักชันค่ะ 🎥 ขอทราบชื่อ-นามสกุลก่อนนะคะ 😊';
  if (!u.position) return `ยินดีที่ได้รู้จักค่ะคุณ${u.full_name} 😊 ปกติคุณทำตำแหน่งอะไรในกองถ่ายคะ? (เช่น Camera Assistant, Gaffer, Art, PA)`;
  if (!u.portfolio_url) return BEST_WORK_CREW;
  return DONE_TEXTS.join('\n');
}

/**
 * Applicants still applying: editors finish by sending their best work; crew answer name → position → best work.
 * Returns the reply bubbles, or null to let the AI answer (questions and small talk).
 */
async function intake(db: ReturnType<typeof sbAdmin>, u: LineUser, msg: string): Promise<string[] | null> {
  if (!['editor', 'crew'].includes(u.role || '') || !['new', 'applying'].includes(u.status)) return null;
  const url = msg.match(URL_RE)?.[0].replace(/[)\]>"']+$/, '') || '';
  const patch: Record<string, string> = {};
  if (url) patch.portfolio_url = url.slice(0, 500);
  else if (QUESTION.test(msg)) return null;
  else if (u.role === 'crew' && !u.full_name && msg.length <= 60) patch.full_name = msg.replace(/^(ชื่อ|ผม|ฉัน|ดิฉัน|หนู)\s*/, '').trim();
  else if (u.role === 'crew' && u.full_name && !u.position && msg.length <= 120) patch.position = msg.replace(/^(ได้หมด(เลย)?(ครับ|ค่ะ)?\s*)?(ส่วนใหญ่|ปกติ|หลัก ๆ)?\s*(ทำ|เป็น)?\s*/, '').trim() || msg;
  else return null;

  const next = { ...u, ...patch } as LineUser;
  const complete = !!next.portfolio_url && (u.role === 'editor' || (!!next.full_name && !!next.position));
  const now = new Date().toISOString();
  await db.from('line_users').update({ ...patch, ...(complete ? { status: 'applied', applied_at: now, status_changed_at: now } : { status: 'applying' }) }).eq('line_user_id', u.line_user_id);
  Object.assign(u, patch);
  if (complete) return DONE_TEXTS;
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
