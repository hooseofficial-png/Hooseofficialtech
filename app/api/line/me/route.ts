import { NextResponse } from 'next/server';
import { sbAdmin } from '@/lib/supabase/server';
import { verifyIdToken } from '@/lib/line';
import { myProjects } from '@/lib/line-projects';

// LIFF "my status / my projects": everything here belongs to the LINE user proven by the ID token.
export const runtime = 'nodejs';


export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { idToken?: string };
  const who = await verifyIdToken(body.idToken || '');
  if (!who) return NextResponse.json({ error: 'ยืนยันตัวตน LINE ไม่สำเร็จ ปิดหน้านี้แล้วเปิดใหม่จากแชท' }, { status: 401 });
  const db = sbAdmin();
  const { data: u } = await db.from('line_users')
    .select('display_name, picture_url, full_name, phone, email, role, status, position, portfolio_url, survey, survey_done_at, interview_url, applied_at, status_changed_at, profile_id')
    .eq('line_user_id', who.sub).maybeSingle();
  if (!u) return NextResponse.json({ user: null, projects: [] });

  const projects = await myProjects(db, who.sub, u.profile_id);

  const { profile_id: _p, ...safe } = u; void _p;
  return NextResponse.json({ user: safe, projects });
}
