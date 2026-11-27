import type { SupabaseClient } from '@supabase/supabase-js';

// Projects one LINE person works on: Open Call positions the HOOSE team confirmed for them,
// plus projects of their linked app account. Server only (service-role client).

export type MyProject = {
  id: string; name: string; brand: string; type: string; start_date: string | null; end_date: string | null; locations: string[] | null;
  call_time: string | null; synopsis: string | null; pm_name: string | null; pm_phone: string | null; party_code: string | null;
  position: string; state: string; upcoming: { type: string; date: string; time: string | null; title: string }[];
};

const COLS = 'id, name, brand, type, start_date, end_date, locations, call_time, synopsis, pm_name, pm_phone, party_code';

export async function myProjects(db: SupabaseClient, lineUserId: string, profileId: string | null): Promise<MyProject[]> {
  const byId = new Map<string, Omit<MyProject, 'upcoming'>>();
  const { data: acc } = await db.from('open_call_responses').select('position_id, selected_at').eq('line_user_id', lineUserId).eq('answer', 'accept');
  const ids = (acc || []).map(a => a.position_id);
  const picked = new Set((acc || []).filter(a => a.selected_at).map(a => a.position_id));
  if (ids.length) {
    const { data: pos } = await db.from('crew_positions').select(`id, position, status, projects(${COLS})`).in('id', ids);
    for (const p of (pos || []) as unknown as { id: string; position: string; status: string; projects: MyProject | null }[]) {
      if (!p.projects) continue;
      const mine = picked.has(p.id);
      byId.set(p.projects.id, { ...p.projects, party_code: mine ? p.projects.party_code : null, position: p.position, state: mine ? 'ยืนยันแล้ว' : p.status === 'open' ? 'รอทีมงานพิจารณา' : 'ไม่ได้รับเลือกรอบนี้' });
    }
  }
  if (profileId) {
    const { data: mem } = await db.from('project_members').select(`position, projects(${COLS})`).eq('user_id', profileId);
    for (const m of (mem || []) as unknown as { position: string; projects: MyProject | null }[])
      if (m.projects) byId.set(m.projects.id, { ...m.projects, position: m.position || byId.get(m.projects.id)?.position || '', state: 'อยู่ในกองถ่ายแล้ว' });
  }
  const pids = Array.from(byId.keys());
  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const { data: ev } = pids.length
    ? await db.from('events').select('project_id, type, date, time, title').in('project_id', pids).gte('date', today).order('date').limit(60)
    : { data: [] as { project_id: string; type: string; date: string; time: string | null; title: string }[] };
  return Array.from(byId.values())
    .map(p => ({ ...p, upcoming: (ev || []).filter(e => e.project_id === p.id).slice(0, 5).map(({ type, date, time, title }) => ({ type, date, time, title })) }))
    .sort((a, b) => (a.start_date || '9').localeCompare(b.start_date || '9'));
}
