import { NextResponse } from 'next/server';
import { sbAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin';

// Admin · LINE OA applicants: everyone who added the OA, with funnel counts.
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { data, error } = await sbAdmin().from('line_users')
    .select('line_user_id, display_name, full_name, phone, email, role, status, position, portfolio_url, following, created_at, last_seen_at, applied_at, needs_attention, attention_note, survey, survey_done_at, picture_url')
    .order('last_seen_at', { ascending: false }).limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data });
}
