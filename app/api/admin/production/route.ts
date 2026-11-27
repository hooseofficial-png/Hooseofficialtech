import { NextResponse } from 'next/server';
import { sbAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin';

// Admin · Production: every project with crew fill rate and the next date.
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const db = sbAdmin();
  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const [{ data: projects }, { data: crew }, { data: events }] = await Promise.all([
    db.from('projects').select('id, name, brand, type, pm_name, start_date, end_date, party_code, created_at').order('start_date', { ascending: false, nullsFirst: false }).limit(200),
    db.from('crew_positions').select('project_id, status'),
    db.from('events').select('project_id, type, date, time, title').gte('date', today).order('date')
  ]);
  const rows = (projects || []).map(p => {
    const c = (crew || []).filter(x => x.project_id === p.id);
    const next = (events || []).find(e => e.project_id === p.id) || null;
    const phase = p.end_date && p.end_date < today ? 'done' : p.start_date && p.start_date <= today ? 'shooting' : 'pre';
    return { ...p, phase, crew: { total: c.length, open: c.filter(x => x.status === 'open').length, pending: c.filter(x => x.status === 'pending').length, confirmed: c.filter(x => x.status === 'confirmed').length }, next };
  });
  return NextResponse.json({ projects: rows });
}
