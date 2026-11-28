import { NextResponse } from 'next/server';
import { sbAdmin } from '@/lib/supabase/server';
import { verifyIdToken } from '@/lib/line';
import { editorWork } from '@/lib/editor-work';

// LIFF "งานของฉัน" for editors: their ClickUp tasks and performance, proven by the LINE ID token.
export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  const { idToken } = await req.json().catch(() => ({})) as { idToken?: string };
  const who = await verifyIdToken(idToken || '');
  if (!who) return NextResponse.json({ error: 'ยืนยันตัวตน LINE ไม่สำเร็จ ปิดหน้านี้แล้วเปิดใหม่จากแชท' }, { status: 401 });
  return NextResponse.json(await editorWork(sbAdmin(), who.sub));
}
