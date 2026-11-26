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

export async function getProfile(userId: string): Promise<{ displayName: string; pictureUrl?: string } | null> {
  try { return await (await call('/profile/' + encodeURIComponent(userId), undefined, 'GET')).json(); }
  catch { return null; }
}

/** LINE text messages are capped at 5,000 characters. */
export function text(t: string): LineMessage {
  return { type: 'text', text: (t || '…').slice(0, 4900) };
}
