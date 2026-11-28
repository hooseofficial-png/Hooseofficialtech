import type { SupabaseClient } from '@supabase/supabase-js';

// PDFs the team sends on LINE at the onboarding step (bucket line-docs is private; LINE gets 60-day signed links).
export const DOCS_BUCKET = 'line-docs';

export async function docLinks(db: SupabaseClient, role: string | null) {
  const { data } = await db.from('line_documents').select('name, path, audience').eq('active', true).order('created_at');
  const mine = (data || []).filter(d => d.audience === 'all' || d.audience === role);
  const out: { name: string; url: string }[] = [];
  for (const d of mine) {
    const { data: s } = await db.storage.from(DOCS_BUCKET).createSignedUrl(d.path, 60 * 24 * 3600);
    if (s?.signedUrl) out.push({ name: d.name, url: s.signedUrl });
  }
  return out;
}
