import { NextResponse } from 'next/server';
import { sbAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin';
import { positionMatch } from '@/lib/opencall';

// Admin · Open Calls created by PMs in the app (announcements), who can receive them on LINE, and who answered.
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const db = sbAdmin();
  const { data: anns } = await db.from('announcements')
    .select('id, project_id, position_ids, status, error, created_at, sent_at, projects(name, brand, type, start_date, end_date, party_code)')
    .order('created_at', { ascending: false }).limit(30);
  const posIds = Array.from(new Set((anns || []).flatMap(a => a.position_ids || [])));
  const [{ data: positions }, { data: responses }, { data: crew }] = await Promise.all([
    posIds.length ? db.from('crew_positions').select('id, position, status, scope, days, name').in('id', posIds) : Promise.resolve({ data: [] as never[] }),
    posIds.length ? db.from('open_call_responses').select('position_id, line_user_id, answer, created_at, selected_at').in('position_id', posIds) : Promise.resolve({ data: [] as never[] }),
    db.from('line_users').select('line_user_id, display_name, full_name, role, position, portfolio_url, phone, picture_url').in('status', ['approved', 'active']).eq('following', true)
  ]);
  const people = new Map((crew || []).map(c => [c.line_user_id, c]));
  const out = (anns || []).map(a => ({
    ...a,
    positions: (a.position_ids || []).map((pid: string) => {
      const p = (positions || []).find(x => x.id === pid);
      if (!p) return null;
      return {
        ...p,
        matches: (crew || []).filter(c => positionMatch(p.position, c.position)).length,
        responses: (responses || []).filter(r => r.position_id === pid).map(r => ({ ...r, person: people.get(r.line_user_id) || null }))
      };
    }).filter(Boolean)
  }));
  return NextResponse.json({ announcements: out, teamSize: (crew || []).length });
}
