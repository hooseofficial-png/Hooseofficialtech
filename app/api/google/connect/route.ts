import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { GOOGLE_SCOPES, googleConfigured, redirectUri, siteUrl } from '@/lib/google';

// Start "เชื่อม Google Calendar": send the signed-in user to Google's consent screen.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = (url.searchParams.get('next') || '/account').startsWith('/') ? (url.searchParams.get('next') || '/account') : '/account';
  const back = new URL(next, siteUrl(req));
  if (!googleConfigured()) { back.searchParams.set('google', 'not_configured'); return NextResponse.redirect(back); }
  const state = randomBytes(24).toString('hex');
  const g = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  g.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: redirectUri(req), response_type: 'code',
    scope: GOOGLE_SCOPES, access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state
  }).toString();
  const res = NextResponse.redirect(g);
  const opts = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/api/google', maxAge: 600 };
  res.cookies.set('g_state', state, opts); res.cookies.set('g_next', next, opts);
  return res;
}
