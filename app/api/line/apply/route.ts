import { NextResponse } from 'next/server';
import { sbAdmin } from '@/lib/supabase/server';
import { push, verifyIdToken } from '@/lib/line';
import { appliedCard } from '@/lib/line-cards';

// Application form submitted from the LIFF page (/line/apply).
// The LIFF ID token proves which LINE user is applying, so nobody can submit for someone else.

export const runtime = 'nodejs';

const ROLES = ['editor', 'crew'];
const LATER = ['interview', 'approved', 'active']; // already further along the funnel: keep that status

const clean = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 }); }

  const who = await verifyIdToken(clean(body.idToken, 4000));
  if (!who) return NextResponse.json({ error: 'ยืนยันตัวตน LINE ไม่สำเร็จ ปิดหน้านี้แล้วเปิดใหม่จากแชท' }, { status: 401 });

  const role = clean(body.role, 20);
  const full_name = clean(body.full_name, 120);
  const phone = clean(body.phone, 30).replace(/[^\d+]/g, '');
  const email = clean(body.email, 200).toLowerCase();
  const position = clean(body.position, 80);
  const portfolio_url = clean(body.portfolio_url, 500);

  if (!ROLES.includes(role)) return NextResponse.json({ error: 'เลือกบทบาท: นักตัดต่อ หรือ ทีมโปรดักชัน' }, { status: 400 });
  if (full_name.length < 2) return NextResponse.json({ error: 'กรอกชื่อ-นามสกุล' }, { status: 400 });
  if (!/^\+?\d{9,15}$/.test(phone)) return NextResponse.json({ error: 'เบอร์โทรไม่ถูกต้อง' }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'อีเมลไม่ถูกต้อง' }, { status: 400 });
  if (!position) return NextResponse.json({ error: 'กรอกตำแหน่ง' }, { status: 400 });
  if (!/^https:\/\/\S+\.\S+/.test(portfolio_url)) return NextResponse.json({ error: 'ลิงก์ผลงานต้องขึ้นต้นด้วย https://' }, { status: 400 });
  if (body.consent !== true) return NextResponse.json({ error: 'กรุณายินยอมให้เก็บข้อมูล (PDPA)' }, { status: 400 });

  const db = sbAdmin();
  const { data: cur } = await db.from('line_users').select('status, display_name').eq('line_user_id', who.sub).maybeSingle();
  const now = new Date().toISOString();
  const keep = cur && LATER.includes(cur.status);
  const row = {
    line_user_id: who.sub, role, full_name, phone, email, position, portfolio_url,
    consent_at: now, applied_at: now, last_seen_at: now,
    ...(keep ? {} : { status: 'applied', status_changed_at: now }),
    ...(cur ? {} : { display_name: who.name || '' })
  };
  const { error } = await db.from('line_users').upsert(row, { onConflict: 'line_user_id' });
  if (error) { console.error('apply upsert', error.message); return NextResponse.json({ error: 'บันทึกไม่สำเร็จ ลองอีกครั้ง' }, { status: 500 }); }

  await db.from('line_messages').insert({ line_user_id: who.sub, role: 'user', content: `[ส่งใบสมัคร] ${role} · ${position} · ${portfolio_url}` });
  try { await push(who.sub, [appliedCard(full_name, role)]); } catch (e) { console.error('apply push', (e as Error).message); }
  return NextResponse.json({ ok: true });
}
