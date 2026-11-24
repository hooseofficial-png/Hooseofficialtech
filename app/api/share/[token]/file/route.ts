import { NextResponse } from 'next/server';
import { sbAdmin } from '@/lib/supabase/server';

// Signed download for a file shown on a public share page. Checks the link is on and the file belongs to that project.
export async function GET(req: Request, { params }: { params: { token: string } }) {
  const path = new URL(req.url).searchParams.get('path') || '';
  const admin = sbAdmin();
  const { data: p } = await admin.from('projects').select('id').eq('share_token', params.token).eq('share_enabled', true).maybeSingle();
  if (!p || !path.startsWith(`projects/${p.id}/`) || path.includes('..')) return new NextResponse('ไม่พบไฟล์หรือไม่มีสิทธิ์', { status: 404 });
  const { data, error } = await admin.storage.from('project-files').createSignedUrl(path, 600);
  if (error || !data) return new NextResponse('ไม่พบไฟล์', { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
