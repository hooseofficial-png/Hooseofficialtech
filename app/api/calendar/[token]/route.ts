import { createClient } from '@supabase/supabase-js';

// Personal iCal feed: every dated appointment from every project the token's owner belongs to.
// Google Calendar subscribes to this URL ("From URL") and refreshes it on its own schedule.
export const dynamic = 'force-dynamic';

const KIND: Record<string, string> = { shoot: 'Shoot Day', brief: 'Brief before Production', meeting: 'Meeting' };
const esc = (s: string) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const fold = (line: string) => { const out: string[] = []; let s = line; while (Buffer.byteLength(s) > 74) { let n = 74; while (Buffer.byteLength(s.slice(0, n)) > 74) n--; out.push(s.slice(0, n)); s = ' ' + s.slice(n); } out.push(s); return out.join('\r\n'); };
const ymd = (d: string) => d.replace(/-/g, '');
// Bangkok is UTC+7 all year: local wall time → UTC stamp.
const utc = (d: string, t: string, addMin = 0) => {
  const [y, m, dd] = d.split('-').map(Number); const [h, mi] = t.split(':').map(Number);
  const x = new Date(Date.UTC(y, m - 1, dd, h - 7, mi + addMin));
  return x.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
};
const nextDay = (d: string) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10).replace(/-/g, ''); };

export async function GET(req: Request, { params }: { params: { token: string } }) {
  const token = params.token.replace(/\.ics$/i, '');
  if (!/^[a-f0-9]{32,80}$/.test(token)) return new Response('Not found', { status: 404 });
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data: feed, error } = await db.rpc('calendar_feed', { p_token: token });
  if (error) { console.error('calendar feed lookup failed:', error.message, error.code); return new Response('Feed unavailable', { status: 503 }); }
  if (!feed) return new Response('Not found', { status: 404 });
  if (/google/i.test(req.headers.get('user-agent') || '')) await db.rpc('calendar_feed_seen', { p_token: token });
  const me = { full_name: feed.full_name as string | null };
  const projects = (feed.projects || []) as any[]; const events = (feed.events || []) as any[];
  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const P = Object.fromEntries((projects || []).map(p => [p.id, p]));
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HOOSE//Production Management//TH', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:HOOSE' + (me.full_name ? ' · ' + esc(me.full_name) : ''), 'X-WR-TIMEZONE:Asia/Bangkok', 'X-PUBLISHED-TTL:PT1H', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H'];
  for (const e of events || []) {
    const p = P[e.project_id] || {}; const label = e.title || e.kind || KIND[e.type] || 'นัดหมาย';
    lines.push('BEGIN:VEVENT', 'UID:' + e.id + '@hoose', 'DTSTAMP:' + stamp);
    if (e.time) {
      const t = String(e.time).slice(0, 5);
      const wrap = e.type === 'shoot' && p.wrap_time && String(p.wrap_time).slice(0, 5) > t ? String(p.wrap_time).slice(0, 5) : null;
      lines.push('DTSTART:' + utc(e.date, t), 'DTEND:' + (wrap ? utc(e.date, wrap) : utc(e.date, t, e.type === 'shoot' ? 600 : 120)));
    } else lines.push('DTSTART;VALUE=DATE:' + ymd(e.date), 'DTEND;VALUE=DATE:' + nextDay(e.date));
    lines.push('SUMMARY:' + esc('[' + (p.name || 'HOOSE') + '] ' + (e.kind && e.title ? e.kind + ' · ' : '') + label));
    if (e.type === 'shoot' && p.locations?.[0]) lines.push('LOCATION:' + esc(p.locations[0]));
    lines.push('DESCRIPTION:' + esc([p.brand, e.kind || KIND[e.type], site + '/p/' + e.project_id + '/calendar'].filter(Boolean).join('\n')));
    lines.push('URL:' + site + '/p/' + e.project_id + '/calendar', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return new Response(lines.map(fold).join('\r\n') + '\r\n', {
    headers: { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': 'inline; filename="hoose.ics"', 'cache-control': 'no-store' }
  });
}
