import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { sbAdmin } from '@/lib/supabase/server';
import { getSetting, setSetting } from '@/lib/settings';
import { runChecks } from '@/lib/editing-engine';

// ClickUp → HOOSE: something changed in the editing list (new task, status, assignee, due date).
// Signed with the webhook secret saved when the admin connected it (app_settings).
// Runs the deadline / overdue / finished checks; LINE messages go out only when there is news.
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const raw = await req.text();
  const db = sbAdmin();
  const secret = await getSetting(db, 'clickup_webhook_secret');
  const sig = req.headers.get('x-signature') || '';
  const want = secret ? createHmac('sha256', secret).update(raw).digest('hex') : '';
  if (!secret || sig.length !== want.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(want)))
    return NextResponse.json({ error: 'bad signature' }, { status: 401 });

  // Bursts of edits arrive together: one check per 20 s is enough.
  const last = Number(await getSetting(db, 'clickup_last_check')) || 0;
  if (Date.now() - last < 20e3) return NextResponse.json({ ok: true, skipped: 'debounced' });
  await setSetting(db, 'clickup_last_check', String(Date.now()));
  try {
    const r = await runChecks(db);
    if (r.errors.length) console.error('clickup checks', r.errors.join(' | '));
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error('clickup webhook', (e as Error).message);
    return NextResponse.json({ ok: false });
  }
}
