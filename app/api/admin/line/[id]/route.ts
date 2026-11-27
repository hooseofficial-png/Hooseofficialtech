import { NextResponse } from 'next/server';
import { sbAdmin } from '@/lib/supabase/server';
import { requireAdmin, STATUSES } from '@/lib/admin';
import { push, text } from '@/lib/line';

// Admin · one applicant: profile + chat history (GET), change status / note and optionally message them on LINE (PATCH).
export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const db = sbAdmin();
  const [{ data: user }, { data: messages }] = await Promise.all([
    db.from('line_users').select('*').eq('line_user_id', params.id).maybeSingle(),
    db.from('line_messages').select('id, role, content, created_at').eq('line_user_id', params.id).order('id', { ascending: false }).limit(300)
  ]);
  if (!user) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ user, messages: (messages || []).reverse() });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json().catch(() => ({})) as { status?: string; note?: string; notify?: string };
  const patch: Record<string, unknown> = {};
  if (b.status !== undefined) {
    if (!(STATUSES as readonly string[]).includes(b.status)) return NextResponse.json({ error: 'bad status' }, { status: 400 });
    patch.status = b.status; patch.status_changed_at = new Date().toISOString();
  }
  if (typeof b.note === 'string') patch.note = b.note.slice(0, 4000);
  const db = sbAdmin();
  if (Object.keys(patch).length) {
    const { error } = await db.from('line_users').update(patch).eq('line_user_id', params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  let sent = false; let sendError = '';
  const msg = (b.notify || '').trim().slice(0, 2000);
  if (msg) {
    try {
      await push(params.id, [text(msg)]); sent = true;
      await db.from('line_messages').insert({ line_user_id: params.id, role: 'assistant', content: `[แอดมิน] ${msg}` });
    } catch (e) { sendError = (e as Error).message; }
  }
  return NextResponse.json({ ok: true, sent, sendError });
}
