import { NextResponse } from 'next/server';
import { sbAdmin } from '@/lib/supabase/server';
import { verifyIdToken } from '@/lib/line';

// LIFF "my status / my projects": everything here belongs to the LINE user proven by the ID token.
export const runtime = 'nodejs';

type Proj = { id: string; name: string; brand: string; type: string; start_date: string | null; end_date: string | null; locations: string[] | null };

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { idToken?: string };
  const who = await verifyIdToken(body.idToken || '');
  if (!who) return NextResponse.json({ error: 'ยืนยันตัวตน LINE ไม่สำเร็จ ปิดหน้านี้แล้วเปิดใหม่จากแชท' }, { status: 401 });
  const db = sbAdmin();
  const { data: u } = await db.from('line_users')
    .select('display_name, picture_url, full_name, phone, email, role, status, position, portfolio_url, survey, survey_done_at, interview_url, applied_at, status_changed_at, profile_id')
    .eq('line_user_id', who.sub).maybeSingle();
  if (!u) return NextResponse.json({ user: null, projects: [] });

  // Projects: Open Calls this person accepted, plus projects of their linked app account.
  const byId = new Map<string, { project: Proj; position: string; state: string }>();
  const { data: accepted } = await db.from('open_call_responses').select('position_id').eq('line_user_id', who.sub).eq('answer', 'accept');
  const posIds = (accepted || []).map(a => a.position_id);
  if (posIds.length) {
    const { data: pos } = await db.from('crew_positions').select('position, status, projects(id, name, brand, type, start_date, end_date, locations)').in('id', posIds);
    for (const p of (pos || []) as unknown as { position: string; status: string; projects: Proj | null }[])
      if (p.projects) byId.set(p.projects.id, { project: p.projects, position: p.position, state: p.status === 'confirmed' ? 'ยืนยันแล้ว' : 'รอ PM ยืนยัน' });
  }
  if (u.profile_id) {
    const { data: mem } = await db.from('project_members').select('position, projects(id, name, brand, type, start_date, end_date, locations)').eq('user_id', u.profile_id);
    for (const m of (mem || []) as unknown as { position: string; projects: Proj | null }[])
      if (m.projects && !byId.has(m.projects.id)) byId.set(m.projects.id, { project: m.projects, position: m.position || '', state: 'สมาชิกโปรเจกต์' });
  }
  const ids = Array.from(byId.keys());
  const today = new Date().toISOString().slice(0, 10);
  const { data: events } = ids.length
    ? await db.from('events').select('project_id, type, date, time, title').in('project_id', ids).gte('date', today).order('date').limit(50)
    : { data: [] as { project_id: string; type: string; date: string; time: string | null; title: string }[] };
  const projects = Array.from(byId.values()).map(x => ({
    ...x.project, position: x.position, state: x.state,
    upcoming: (events || []).filter(e => e.project_id === x.project.id).slice(0, 5)
  })).sort((a, b) => (a.start_date || '9').localeCompare(b.start_date || '9'));

  const { profile_id: _p, ...safe } = u; void _p;
  return NextResponse.json({ user: safe, projects });
}
