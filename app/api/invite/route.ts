import { NextResponse } from 'next/server';
import { sbAdmin, sbServer } from '@/lib/supabase/server';

// Sends the Supabase invite e-mail for someone who has never logged in. Only project editors may call it.
export async function POST(req: Request) {
  const { projectId, email } = await req.json().catch(() => ({}));
  if (!projectId || !email) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  const s = sbServer();
  const { data: ok } = await s.rpc('can_edit', { pid: projectId });
  if (!ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const { error } = await sbAdmin().auth.admin.inviteUserByEmail(String(email).toLowerCase().trim(), { redirectTo: `${site}/auth/callback?next=/p/${projectId}` });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
