import { NextResponse } from 'next/server';
import { sbAdmin } from '@/lib/supabase/server';
import { getProfile, lineConfigured, reply, startLoading, text, verifySignature } from '@/lib/line';
import { SURVEY, nextStepCard, statusCard, surveyCard, surveyDoneCard, welcomeCard, withQuickMenu } from '@/lib/line-cards';
import { answer, SORRY, type LineUser } from '@/lib/line-agent';

// HOOSE Official LINE OA webhook.
// LINE Developers → Messaging API → Webhook URL: https://app.hooseofficial.site/api/line/webhook
//  follow          → save the person, send the welcome card (3 role buttons)
//  postback role   → save the role, send the next recruiting step
//  text message    → "เมนู" shows the welcome card, "สมัคร" the application form card; anything else shows
//                    the typing dots and goes to the AI assistant
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
const USER_COLS = 'line_user_id, display_name, full_name, role, status, position, portfolio_url, memory, survey, survey_done_at';
const APPLY = /^(สมัคร|ใบสมัคร|apply|liff|ฟอร์ม|ฟอร์มสมัคร)$/i;
const STATUS = /^(สถานะ|สถานะของฉัน|status|เช็กสถานะ|เช็คสถานะ)$/i;
const SURVEY_RE = /^(แบบสอบถาม|survey)$/i;

type Survey = Record<string, string | string[]>;
/** First unanswered question, or -1 when all are answered. */
function nextQuestion(s: Survey) { return SURVEY.findIndex(q => q.multi ? !(Array.isArray(s[q.key]) && s[q.key].length && s[q.key + '_done']) : !s[q.key]); }

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
      const status = u.status === 'new' ? 'applying' : u.status;
      await db.from('line_users').update({ role, status }).eq('line_user_id', userId);
      await reply(ev.replyToken, [withQuickMenu(nextStepCard(role), { ...u, role, status })]);
    }
    if (q.get('action') === 'survey') await answerSurvey(db, u, q.get('q') || '', q.get('v') || '', ev.replyToken);
    return;
  }

  if (ev.type === 'message') {
    if (ev.message?.type !== 'text') { await reply(ev.replyToken, [text('ตอนนี้น้องฮูสอ่านได้เฉพาะข้อความตัวอักษรนะคะ ถ้าจะส่งผลงาน พิมพ์ "สมัคร" แล้วแนบลิงก์ในฟอร์มได้เลยค่ะ 😊')]); return; }
    const msg = (ev.message.text || '').trim();
    const quick = (m: ReturnType<typeof text>) => withQuickMenu(m, u);
    if (MENU.test(msg)) { await reply(ev.replyToken, [quick(welcomeCard(u.display_name))]); return; }
    if (APPLY.test(msg)) { await reply(ev.replyToken, [quick(u.role ? nextStepCard(u.role) : welcomeCard(u.display_name))]); return; }
    if (STATUS.test(msg)) { await reply(ev.replyToken, [quick(statusCard(u))]); return; }
    if (SURVEY_RE.test(msg)) {
      const i = nextQuestion((u.survey || {}) as Survey);
      if (u.role !== 'editor') await reply(ev.replyToken, [quick(text('แบบสอบถามนี้สำหรับนักตัดต่อค่ะ 😊'))]);
      else if (!['applied', 'interview'].includes(u.status)) await reply(ev.replyToken, [quick(text('ส่งใบสมัครก่อนนะคะ แล้วแบบสอบถามจะตามมาเลย 📝'))]);
      else await reply(ev.replyToken, [i < 0 ? quick(text('ตอบแบบสอบถามครบแล้วค่ะ ขอบคุณมากนะคะ 🙏')) : surveyCard(i, (u.survey?.[SURVEY[i].key] as string[]) || [])]);
      return;
    }
    await startLoading(userId, 30);
    let out: { text: string; card: string | null } = { text: SORRY, card: null };
    try { out = await answer(db, u, msg); }
    catch (e) {
      // Logged for the team (Vercel logs + admin page); the user only sees a friendly line.
      const why = (e as Error).message;
      console.error('line agent failed', why);
      await db.from('line_users').update({ needs_attention: true, attention_note: 'ผู้ช่วยตอบไม่ได้: ' + why.slice(0, 300), attention_at: new Date().toISOString() }).eq('line_user_id', userId);
    }
    const msgs = [text(out.text)];
    if (out.card === 'form' && u.role) msgs.push(nextStepCard(u.role));
    if (out.card === 'status') msgs.push(statusCard(u));
    if (out.card === 'survey') { const i = nextQuestion((u.survey || {}) as Survey); if (i >= 0) msgs.push(surveyCard(i, (u.survey?.[SURVEY[i].key] as string[]) || [])); }
    msgs[msgs.length - 1] = quick(msgs[msgs.length - 1]);
    await reply(ev.replyToken, msgs);
  }
}

/** Saves one tapped answer and replies with the next question (reply messages are free). */
async function answerSurvey(db: ReturnType<typeof sbAdmin>, u: LineUser, key: string, value: string, replyToken: string) {
  const qi = SURVEY.findIndex(q => q.key === key);
  if (qi < 0 || u.role !== 'editor') return;
  const q = SURVEY[qi];
  const survey: Survey = { ...((u.survey || {}) as Survey) };
  if (q.multi) {
    const cur = Array.isArray(survey[key]) ? [...(survey[key] as string[])] : [];
    if (value === '__done') {
      if (!cur.length) { await reply(replyToken, [surveyCard(qi, cur)]); return; }
      survey[key + '_done'] = '1';
    } else if ((q.options as readonly (readonly [string, string])[]).some(([v]) => v === value)) {
      survey[key] = cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value];
      await db.from('line_users').update({ survey }).eq('line_user_id', u.line_user_id);
      await reply(replyToken, [surveyCard(qi, survey[key] as string[])]);
      return;
    } else return;
  } else {
    if (!(q.options as readonly (readonly [string, string])[]).some(([v]) => v === value)) return;
    survey[key] = value;
  }
  const next = nextQuestion(survey);
  const done = next < 0;
  await db.from('line_users').update({ survey, ...(done && !u.survey_done_at ? { survey_done_at: new Date().toISOString() } : {}) }).eq('line_user_id', u.line_user_id);
  await reply(replyToken, [done ? withQuickMenu(surveyDoneCard(), { ...u, survey_done_at: 'x' }) : surveyCard(next, (survey[SURVEY[next].key] as string[]) || [])]);
}
