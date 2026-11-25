import { NextResponse } from 'next/server';
import { googleConfigured } from '@/lib/google';
import { sbAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
// Server setup check (booleans only): Google OAuth configured? service-role key able to read the database?
export async function GET() {
  let admin = false;
  try { const { count, error } = await sbAdmin().from('profiles').select('id', { count: 'exact', head: true }); admin = !error && (count ?? 0) > 0; } catch { admin = false; }
  return NextResponse.json({ configured: googleConfigured(), admin });
}
