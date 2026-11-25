import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sbAdmin, sbServer } from '@/lib/supabase/server';
import { redirectUri, siteUrl } from '@/lib/google';

// Google sends the user back here after consent: swap the code for tokens and store them for this HOOSE account.
export async function GET(req: Request) {
  const url = new URL(req.url); const jar = cookies();
  const next = jar.get('g_next')?.value || '/account';
  const back = (status: string) => {
    const u = new URL(next.startsWith('/') ? next : '/account', siteUrl(req)); u.searchParams.set('google', status);
    const res = NextResponse.redirect(u); res.cookies.delete({ name: 'g_state', path: '/api/google' }); res.cookies.delete({ name: 'g_next', path: '/api/google' }); return res;
  };
  if (url.searchParams.get('error')) return back('denied');
  const code = url.searchParams.get('code'); const state = url.searchParams.get('state');
  if (!code || !state || state !== jar.get('g_state')?.value) return back('error');
  const { data: { user } } = await sbServer().auth.getUser();
  if (!user) return back('error');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: redirectUri(req), grant_type: 'authorization_code' })
  });
  const t = await r.json().catch(() => ({}));
  if (!r.ok || !t.access_token) { console.error('google token exchange failed', t.error); return back('error'); }
  let email = '';
  try { email = JSON.parse(Buffer.from(String(t.id_token).split('.')[1], 'base64url').toString()).email || ''; } catch { /* no id_token */ }
  const db = sbAdmin();
  const row: Record<string, unknown> = { user_id: user.id, google_email: email, access_token: t.access_token, expires_at: new Date(Date.now() + (t.expires_in || 3600) * 1000).toISOString(), connected_at: new Date().toISOString() };
  if (t.refresh_token) row.refresh_token = t.refresh_token;
  else {
    const { data: old } = await db.from('google_connections').select('refresh_token').eq('user_id', user.id).maybeSingle();
    if (!old) return back('error');
  }
  const { error } = await db.from('google_connections').upsert(row, { onConflict: 'user_id' });
  if (error) { console.error('google connection save failed', error.message); return back('error'); }
  return back('connected');
}
