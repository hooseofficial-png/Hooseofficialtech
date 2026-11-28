import { NextResponse } from 'next/server';
import { sbAdmin, sbServer } from '@/lib/supabase/server';
import { editorWork } from '@/lib/editor-work';

// Editor home in the HOOSE app: same data as the LINE page, for the signed-in account linked to a LINE editor.
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  const { data: { user } } = await sbServer().auth.getUser();
  if (!user) return NextResponse.json({ error: 'login' }, { status: 401 });
  const db = sbAdmin();
  const { data: lu } = await db.from('line_users').select('line_user_id').eq('profile_id', user.id).eq('role', 'editor').limit(1).maybeSingle();
  if (!lu) return NextResponse.json({ linked: false, reason: 'not_editor' });
  try { return NextResponse.json(await editorWork(db, lu.line_user_id)); }
  catch (e) { return NextResponse.json({ error: 'โหลดงานจาก ClickUp ไม่สำเร็จ ลองใหม่อีกครั้ง' + (process.env.NODE_ENV === 'development' ? ': ' + (e as Error).message : '') }, { status: 502 }); }
}
