import { sbAdmin, sbServer } from '@/lib/supabase/server';

/** Server only. Returns the signed-in user's id when they are listed in hoose_admins (added by hand), else null. */
export async function requireAdmin(): Promise<string | null> {
  const { data: { user } } = await sbServer().auth.getUser();
  if (!user) return null;
  const { data } = await sbAdmin().from('hoose_admins').select('user_id').eq('user_id', user.id).maybeSingle();
  return data ? user.id : null;
}

export const STATUSES = ['new', 'applying', 'applied', 'interview', 'approved', 'rejected', 'active', 'blocked'] as const;
