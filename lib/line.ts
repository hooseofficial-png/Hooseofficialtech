import { createHmac, timingSafeEqual } from 'crypto';

// HOOSE Official LINE OA · Messaging API helpers (server only).
// Env: LINE_CHANNEL_SECRET (checks webhook signatures), LINE_CHANNEL_ACCESS_TOKEN (sends messages).

const API = 'https://api.line.me/v2/bot';

export type LineMessage = Record<string, unknown>;

export function lineConfigured() {
  return !!(process.env.LINE_CHANNEL_SECRET && process.env.LINE_CHANNEL_ACCESS_TOKEN);
}

/** True when the x-line-signature header matches HMAC-SHA256(channel secret, raw body). */
export function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  let given: Buffer;
  try { given = Buffer.from(signature, 'base64'); } catch { return false; }
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function call(path: string, body?: unknown, method = 'POST') {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: 'Bearer ' + process.env.LINE_CHANNEL_ACCESS_TOKEN, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(`LINE ${path} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res;
}

/** Free reply to an incoming event (reply token is single-use and short-lived). Up to 5 messages. */
export function reply(replyToken: string, messages: LineMessage[]) {
  return call('/message/reply', { replyToken, messages: messages.slice(0, 5) });
}

/** Message one person at any time (counts toward the monthly quota). */
export function push(to: string, messages: LineMessage[]) {
  return call('/message/push', { to, messages: messages.slice(0, 5) });
}

/** Message up to 500 people at once (counts once per recipient). */
export function multicast(to: string[], messages: LineMessage[]) {
  return call('/message/multicast', { to: to.slice(0, 500), messages: messages.slice(0, 5) });
}

/** "Typing…" dots in a 1:1 chat while the reply is prepared. Free; disappears when a message is sent. */
export async function startLoading(userId: string, seconds = 20) {
  try { await call('/chat/loading/start', { chatId: userId, loadingSeconds: Math.min(60, Math.max(5, Math.round(seconds / 5) * 5)) }); }
  catch (e) { console.error('line loading failed', (e as Error).message); }
}

/** Checks a LIFF ID token with LINE and returns the LINE user id (sub). Env: LINE_LOGIN_CHANNEL_ID. */
export async function verifyIdToken(idToken: string): Promise<{ sub: string; name?: string; email?: string } | null> {
  const clientId = process.env.LINE_LOGIN_CHANNEL_ID;
  if (!clientId || !idToken) return null;
  const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: idToken, client_id: clientId })
  });
  if (!res.ok) return null;
  const j = await res.json();
  return j?.sub ? { sub: j.sub, name: j.name, email: j.email } : null;
}

export async function getProfile(userId: string): Promise<{ displayName: string; pictureUrl?: string } | null> {
  try { return await (await call('/profile/' + encodeURIComponent(userId), undefined, 'GET')).json(); }
  catch { return null; }
}

/** LINE text messages are capped at 5,000 characters. */
export function text(t: string): LineMessage {
  return { type: 'text', text: (t || '…').slice(0, 4900) };
}
