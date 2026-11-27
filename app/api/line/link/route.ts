import { NextResponse } from 'next/server';
import { sbAdmin, sbServer } from '@/lib/supabase/server';
import { push, text, verifyLink } from '@/lib/line';
import { ACCOUNT_DONE_TEXTS, withQuickMenu } from '@/lib/line-cards';

// Links the signed-in app account to the LINE person in the signed token (from the "สร้างบัญชีกองถ่าย" button),
// marks them active and sends the welcome-to-the-crew messages on LINE.
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { t } = await req.json().catch(() => ({})) as { t?: string };
  const lineUserId = verifyLink(t || '');
  if (!lineUserId) return NextResponse.json({ error: 'ลิงก์ไม่ถูกต้อง กดปุ่มจากแชท LINE อีกครั้งนะคะ' }, { status: 400 });
  const { data: { user } } = await sbServer().auth.getUser();
  if (!user) return NextResponse.json({ error: 'login' }, { status: 401 });

  const db = sbAdmin();
  const { data: lu } = await db.from('line_users').select('status, role, profile_id, full_name, phone').eq('line_user_id', lineUserId).maybeSingle();
  if (!lu) return NextResponse.json({ error: 'ไม่พบข้อมูลจาก LINE' }, { status: 404 });
  if (!['approved', 'active'].includes(lu.status)) return NextResponse.json({ error: 'ยังไม่ผ่านการคัดเลือก' }, { status: 403 });
  if (lu.profile_id && lu.profile_id !== user.id) return NextResponse.json({ error: 'LINE นี้ผูกกับบัญชีอื่นแล้ว ติดต่อทีม HOOSE ในแชทได้เลยค่ะ' }, { status: 409 });

  const first = !lu.profile_id;
  const now = new Date().toISOString();
  await db.from('line_users').update({ profile_id: user.id, status: 'active', ...(lu.status !== 'active' ? { status_changed_at: now } : {}) }).eq('line_user_id', lineUserId);
  // Fill empty profile fields from the application (never overwrite what the person typed in the app).
  const { data: prof } = await db.from('profiles').select('full_name, phone').eq('id', user.id).maybeSingle();
  const fill: Record<string, string> = {};
  if (prof && !prof.full_name && lu.full_name) fill.full_name = lu.full_name;
  if (prof && !prof.phone && lu.phone) fill.phone = lu.phone;
  if (Object.keys(fill).length) await db.from('profiles').update(fill).eq('id', user.id);

  if (first) {
    const msgs = ACCOUNT_DONE_TEXTS.map(x => text(x));
    msgs[msgs.length - 1] = withQuickMenu(msgs[msgs.length - 1], { role: lu.role, status: 'active' });
    try { await push(lineUserId, msgs); } catch (e) { console.error('link push', (e as Error).message); }
    await db.from('line_messages').insert({ line_user_id: lineUserId, role: 'assistant', content: ACCOUNT_DONE_TEXTS.join('\n') });
  }
  return NextResponse.json({ ok: true, first });
}
