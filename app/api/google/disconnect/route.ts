import { NextResponse } from 'next/server';
import { sbAdmin, sbServer } from '@/lib/supabase/server';

// Remove this user's Google connection (and revoke the grant at Google).
export async function POST() {
  const { data: { user } } = await sbServer().auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = sbAdmin();
  const { data: c } = await db.from('google_connections').select('refresh_token').eq('user_id', user.id).maybeSingle();
  if (c?.refresh_token) await fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(c.refresh_token), { method: 'POST' }).catch(() => null);
  await db.from('google_connections').delete().eq('user_id', user.id);
  return NextResponse.json({ ok: true });
}
