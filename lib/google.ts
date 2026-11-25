import { sbAdmin } from '@/lib/supabase/server';

// Google Calendar API helpers (server only). Tokens live in google_connections, readable only with the service-role key.
export const GOOGLE_SCOPES = 'openid email https://www.googleapis.com/auth/calendar.events';
export const googleConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
export const siteUrl = (req: Request) => process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
export const redirectUri = (req: Request) => siteUrl(req) + '/api/google/callback';
const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

/** A valid access token for this HOOSE user, refreshing it when needed. null = not connected (or access revoked). */
export async function accessTokenFor(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  const db = sbAdmin();
  const { data: c } = await db.from('google_connections').select('refresh_token, access_token, expires_at').eq('user_id', userId).maybeSingle();
  if (!c) return null;
  if (c.access_token && c.expires_at && new Date(c.expires_at).getTime() > Date.now() + 60_000) return c.access_token;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, refresh_token: c.refresh_token, grant_type: 'refresh_token' })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { if (j.error === 'invalid_grant') await db.from('google_connections').delete().eq('user_id', userId); return null; }
  await db.from('google_connections').update({ access_token: j.access_token, expires_at: new Date(Date.now() + (j.expires_in || 3600) * 1000).toISOString() }).eq('user_id', userId);
  return j.access_token as string;
}

export interface EvRow { id: string; project_id: string; kind: string; type: 'shoot' | 'brief' | 'meeting'; date: string | null; time: string | null; title: string }
export interface ProjRow { id: string; name: string; brand: string; locations: string[] | null; wrap_time: string | null }

const KIND: Record<string, string> = { shoot: 'Shoot Day', brief: 'Brief before Production', meeting: 'Meeting' };
const addMin = (d: string, t: string, m: number) => {
  const [y, mo, dd] = d.split('-').map(Number); const [h, mi] = t.split(':').map(Number);
  const x = new Date(Date.UTC(y, mo - 1, dd, h, mi + m));
  return x.toISOString().slice(0, 16) + ':00';
};
const nextDay = (d: string) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };

/** Google event body for a HOOSE appointment (Bangkok time). */
export function eventBody(e: EvRow, p: ProjRow, site: string, attendees: string[]) {
  const label = e.title || e.kind || KIND[e.type] || 'นัดหมาย';
  const link = `${site}/p/${e.project_id}/calendar`;
  let start: Record<string, string>, end: Record<string, string>;
  if (e.time) {
    const t = String(e.time).slice(0, 5);
    const wrap = e.type === 'shoot' && p.wrap_time && String(p.wrap_time).slice(0, 5) > t ? String(p.wrap_time).slice(0, 5) : null;
    start = { dateTime: e.date + 'T' + t + ':00', timeZone: 'Asia/Bangkok' };
    end = { dateTime: wrap ? e.date + 'T' + wrap + ':00' : addMin(e.date!, t, e.type === 'shoot' ? 600 : 120), timeZone: 'Asia/Bangkok' };
  } else { start = { date: e.date! }; end = { date: nextDay(e.date!) }; }
  return {
    summary: `[${p.name || 'HOOSE'}] ${e.kind && e.title ? e.kind + ' · ' : ''}${label}`,
    location: e.type === 'shoot' && p.locations?.[0] ? p.locations[0] : undefined,
    description: [p.brand, e.kind || KIND[e.type], 'เปิดใน HOOSE: ' + link].filter(Boolean).join('\n'),
    start, end,
    attendees: attendees.map(email => ({ email })),
    source: { title: 'HOOSE', url: link },
    extendedProperties: { private: { hooseEventId: e.id } },
    reminders: { useDefault: true }
  };
}

export async function gFetch(token: string, url: string, init: RequestInit = {}) {
  const r = await fetch(url, { ...init, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', ...(init.headers || {}) } });
  const j = r.status === 204 ? {} : await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, json: j as { id?: string; error?: { message?: string } } };
}
export const insertUrl = () => API + '?sendUpdates=all';
export const eventUrl = (gid: string) => API + '/' + encodeURIComponent(gid) + '?sendUpdates=all';
