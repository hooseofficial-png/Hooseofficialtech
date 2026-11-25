'use client';
import { sb } from '@/lib/supabase/client';
import { getCache, setCache, clearCache } from '@/lib/cache';

export interface Me {
  id: string; email: string;
  profile: { full_name: string; email: string; position: string; company: string; phone: string; line_id: string; onboarded_at: string | null; tour_done_at: string | null } | null;
}
let inflight: Promise<Me | null> | null = null;

/** Signed-in user + profile, fetched once per page load and shared by TopBar, overview and account. */
export function getMe(force = false): Promise<Me | null> {
  if (!inflight || force) {
    inflight = (async () => {
      const { data: { session } } = await sb().auth.getSession(); // local read, no network round-trip
      const u = session?.user; if (!u) return null;
      const { data } = await sb().from('profiles').select('full_name, email, position, company, phone, line_id, onboarded_at, tour_done_at').eq('id', u.id).maybeSingle();
      const me: Me = { id: u.id, email: u.email || '', profile: data as Me['profile'] };
      setCache('me', me); return me;
    })();
  }
  return inflight;
}
/** Last known user for an instant first paint (may be stale). */
export const cachedMe = () => getCache<Me>('me');
export async function signOut() { clearCache(); inflight = null; await sb().auth.signOut(); window.location.href = '/login'; }
/** The signed-in auth user from the local session (no network). */
export async function currentUser() { return (await sb().auth.getSession()).data.session?.user ?? null; }
