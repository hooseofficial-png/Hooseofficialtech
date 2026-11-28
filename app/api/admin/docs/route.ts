import { NextResponse } from 'next/server';
import { sbAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin';
import { DOCS_BUCKET } from '@/lib/line-docs';

// Admin · PDFs sent to new team members on LINE (onboarding step). Upload, list, switch on/off, delete.
export const runtime = 'nodejs';

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { data } = await sbAdmin().from('line_documents').select('id, name, audience, active, created_at').order('created_at');
  return NextResponse.json({ docs: data || [] });
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const audience = String(form?.get('audience') || 'all');
  if (!(file instanceof File)) return NextResponse.json({ error: 'เลือกไฟล์ PDF ก่อน' }, { status: 400 });
  if (file.type !== 'application/pdf') return NextResponse.json({ error: 'รองรับเฉพาะไฟล์ PDF' }, { status: 400 });
  if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: 'ไฟล์ใหญ่เกิน 4 MB' }, { status: 400 });
  if (!['all', 'editor', 'crew'].includes(audience)) return NextResponse.json({ error: 'bad audience' }, { status: 400 });
  const db = sbAdmin();
  const name = (String(form?.get('name') || '') || file.name.replace(/\.pdf$/i, '')).slice(0, 80);
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
  const { error: up } = await db.storage.from(DOCS_BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: 'application/pdf' });
  if (up) return NextResponse.json({ error: up.message }, { status: 500 });
  const { error } = await db.from('line_documents').insert({ name, path, audience });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json().catch(() => ({})) as { id?: string; active?: boolean; remove?: boolean };
  const db = sbAdmin();
  if (b.remove) {
    const { data } = await db.from('line_documents').select('path').eq('id', b.id || '').maybeSingle();
    if (data) await db.storage.from(DOCS_BUCKET).remove([data.path]);
    await db.from('line_documents').delete().eq('id', b.id || '');
  } else if (typeof b.active === 'boolean') await db.from('line_documents').update({ active: b.active }).eq('id', b.id || '');
  return NextResponse.json({ ok: true });
}
