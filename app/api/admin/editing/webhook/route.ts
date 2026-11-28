import { NextResponse } from 'next/server';
import { sbAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin';
import { EDIT_LISTS, createWebhook, deleteWebhook } from '@/lib/clickup';
import { getSetting, setSetting } from '@/lib/settings';
import { SITE } from '@/lib/line-cards';

// Admin · connect ClickUp → HOOSE (webhook on the editing list). The signing secret is stored server-side.
export const runtime = 'nodejs';

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return NextResponse.json({ connected: !!(await getSetting(sbAdmin(), 'clickup_webhook_id')) });
}

export async function POST() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const db = sbAdmin();
  const old = await getSetting(db, 'clickup_webhook_id');
  if (old) { try { await deleteWebhook(old); } catch { /* already gone */ } }
  try {
    const w = await createWebhook(SITE + '/api/clickup/webhook', EDIT_LISTS[0]);
    if (!w.id || !w.secret) return NextResponse.json({ error: 'ClickUp ไม่ส่ง webhook secret กลับมา' }, { status: 502 });
    await setSetting(db, 'clickup_webhook_id', w.id);
    await setSetting(db, 'clickup_webhook_secret', w.secret);
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: (e as Error).message.slice(0, 200) }, { status: 502 }); }
}
