import { NextResponse } from 'next/server';
import { sbAdmin } from '@/lib/supabase/server';
import { getProfile, lineConfigured, reply, startLoading, text, verifySignature } from '@/lib/line';
import { nextStepCard, welcomeCard } from '@/lib/line-cards';
import { answer, type LineUser } from '@/lib/line-agent';

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
const USER_COLS = 'line_user_id, display_name, full_name, role, status, position, portfolio_url';
const APPLY = /^(สมัคร|ใบสมัคร|apply)$/i;

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
      await db.from('line_users').update({ role, status: u.status === 'new' ? 'applying' : u.status }).eq('line_user_id', userId);
      await reply(ev.replyToken, [nextStepCard(role)]);
    }
    return;
  }

  if (ev.type === 'message') {
    if (ev.message?.type !== 'text') { await reply(ev.replyToken, [text('ตอนนี้ผู้ช่วยอ่านได้เฉพาะข้อความตัวอักษรครับ ส่งลิงก์ผลงานเป็นข้อความได้เลย')]); return; }
    const msg = (ev.message.text || '').trim();
    if (MENU.test(msg)) { await reply(ev.replyToken, [welcomeCard(u.display_name)]); return; }
    if (APPLY.test(msg)) { await reply(ev.replyToken, [u.role ? nextStepCard(u.role) : welcomeCard(u.display_name)]); return; }
    await startLoading(userId, 30);
    let out: string;
    try { out = await answer(db, u, msg); }
    catch (e) { console.error('line agent failed', (e as Error).message); out = 'ขอโทษครับ ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้งในอีกสักครู่'; }
    await reply(ev.replyToken, [text(out)]);
  }
}
