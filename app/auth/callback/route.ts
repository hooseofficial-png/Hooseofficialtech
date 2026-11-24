import { NextResponse } from 'next/server';
import { sbServer } from '@/lib/supabase/server';

// Magic-link landing: swap the one-time code for a session cookie, then go where the user was heading.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/';
  if (code) await sbServer().auth.exchangeCodeForSession(code);
  return NextResponse.redirect(new URL(next.startsWith('/') ? next : '/', url.origin));
}
