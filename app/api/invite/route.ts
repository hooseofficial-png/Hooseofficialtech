import { NextResponse } from 'next/server';
import { sbServer } from '@/lib/supabase/server';
import { inviteEmail, mailConfigured, sendMail } from '@/lib/mail';

// Invite one or more people to a project and e-mail each of them directly.
// Existing accounts are added at once; new e-mails get a pending invite that is accepted on sign-up.
// POST { projectId, emails: string[], role } → { results: [{ email, status, emailed, link, error? }], mail: boolean }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const projectId = String(body.projectId || '');
  const role = ['owner', 'editor', 'viewer'].includes(body.role) ? body.role : 'viewer';
  const emails: string[] = Array.from(new Set<string>(((body.emails as string[]) || (body.email ? [body.email] : []))
    .map(e => String(e).trim().toLowerCase()).filter(Boolean))).slice(0, 50);
  if (!projectId || !emails.length) return NextResponse.json({ error: 'bad request' }, { status: 400 });

  const s = sbServer();
  const { data: { user } } = await s.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const [{ data: project }, { data: me }] = await Promise.all([
    s.from('projects').select('name').eq('id', projectId).maybeSingle(),
    s.from('profiles').select('full_name, email').eq('id', user.id).maybeSingle()
  ]);
  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const inviter = me?.full_name || me?.email || 'ทีม HOOSE';
  const projectName = project?.name || 'โปรเจกต์ใหม่';
  const mail = mailConfigured();

  const results = [];
  for (const email of emails) {
    const { data: status, error } = await s.rpc('invite_member', { pid: projectId, invite_email: email, invite_role: role });
    if (error) { results.push({ email, status: 'error', emailed: false, link: '', error: error.message }); continue; }
    const hasAccount = status === 'added';
    const link = hasAccount ? `${site}/p/${projectId}` : `${site}/login?mode=signup&email=${encodeURIComponent(email)}&next=${encodeURIComponent('/p/' + projectId)}`;
    let emailed = false; let mailError: string | undefined;
    if (mail) {
      try { const m = inviteEmail({ inviter, project: projectName, role, link, hasAccount, site }); await sendMail(email, m.subject, m.html, m.text); emailed = true; }
      catch (e) { mailError = (e as Error).message; console.error('invite mail failed', email, mailError); }
    }
    results.push({ email, status, emailed, link, error: mailError });
  }
  return NextResponse.json({ results, mail });
}
