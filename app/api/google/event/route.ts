import { NextResponse } from 'next/server';
import { sbAdmin, sbServer } from '@/lib/supabase/server';
import { accessTokenFor, eventBody, eventUrl, gFetch, googleConfigured, insertUrl, siteUrl, type EvRow, type ProjRow } from '@/lib/google';

// Push one HOOSE appointment to Google Calendar, inviting the project team (owner, editors, viewers) by e-mail.
// POST {eventId} = create/update · DELETE {eventId} = remove from Google (call before deleting the row).
type Ctx = { userId: string; ev: EvRow & { google_event_id: string | null; google_owner: string | null }; db: ReturnType<typeof sbAdmin> };

async function load(req: Request): Promise<Ctx | NextResponse> {
  const { eventId } = await req.json().catch(() => ({}));
  if (!eventId) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  const s = sbServer();
  const { data: { user } } = await s.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!googleConfigured()) return NextResponse.json({ status: 'not_configured' });
  const db = sbAdmin();
  const { data: ev } = await db.from('events').select('id, project_id, kind, type, date, time, title, google_event_id, google_owner').eq('id', eventId).maybeSingle();
  if (!ev) return NextResponse.json({ status: 'gone' });
  const { data: ok } = await s.rpc('can_edit', { pid: ev.project_id });
  if (!ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return { userId: user.id, ev, db };
}

async function removeFromGoogle({ ev, db }: Ctx) {
  if (!ev.google_event_id) return false;
  const token = await accessTokenFor(ev.google_owner);
  if (token) await gFetch(token, eventUrl(ev.google_event_id), { method: 'DELETE' });
  await db.from('events').update({ google_event_id: null, google_owner: null, google_synced_at: null }).eq('id', ev.id);
  return true;
}

export async function POST(req: Request) {
  const c = await load(req); if (c instanceof NextResponse) return c;
  const { ev, db, userId } = c;
  if (!ev.date) return NextResponse.json({ status: (await removeFromGoogle(c)) ? 'removed' : 'skipped_tbd' });

  const [{ data: project }, { data: members }] = await Promise.all([
    db.from('projects').select('id, name, brand, locations, wrap_time').eq('id', ev.project_id).maybeSingle(),
    db.from('project_members').select('user_id, role, profiles(email)').eq('project_id', ev.project_id)
  ]);
  const owner = (members || []).find(m => m.role === 'owner')?.user_id as string | undefined;

  // Organizer: whoever already holds the Google event, else the person saving, else the project owner.
  let organizer: string | null = null; let token: string | null = null;
  for (const cand of [ev.google_owner, userId, owner]) { if (cand && (token = await accessTokenFor(cand))) { organizer = cand; break; } }
  if (!organizer || !token) return NextResponse.json({ status: 'not_connected' });

  const emails = Array.from(new Set((members || [])
    .filter(m => m.user_id !== organizer && ['owner', 'editor', 'viewer'].includes(m.role))
    .map(m => String((m.profiles as unknown as { email?: string } | null)?.email || '').toLowerCase())
    .filter(e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))));
  const body = JSON.stringify(eventBody(ev, project as ProjRow, siteUrl(req), emails));

  let r = ev.google_event_id && ev.google_owner === organizer ? await gFetch(token, eventUrl(ev.google_event_id), { method: 'PATCH', body }) : null;
  let status = 'updated';
  if (!r || !r.ok) {
    if (r && ![404, 410].includes(r.status)) { console.error('google patch failed', r.status, r.json.error?.message); return NextResponse.json({ status: 'error', message: r.json.error?.message }, { status: 502 }); }
    if (ev.google_event_id && ev.google_owner && ev.google_owner !== organizer) await removeFromGoogle(c);
    r = await gFetch(token, insertUrl(), { method: 'POST', body }); status = 'added';
  }
  if (!r.ok || !r.json.id) { console.error('google insert failed', r.status, r.json.error?.message); return NextResponse.json({ status: 'error', message: r.json.error?.message }, { status: 502 }); }
  await db.from('events').update({ google_event_id: r.json.id, google_owner: organizer, google_synced_at: new Date().toISOString() }).eq('id', ev.id);
  return NextResponse.json({ status, invited: emails.length, organizer: organizer === userId ? 'me' : 'owner' });
}

export async function DELETE(req: Request) {
  const c = await load(req); if (c instanceof NextResponse) return c;
  return NextResponse.json({ status: (await removeFromGoogle(c)) ? 'removed' : 'skipped' });
}
