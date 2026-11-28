import type { SupabaseClient } from '@supabase/supabase-js';

/** Small server-side key/value store (app_settings, service role only). */
export async function getSetting(db: SupabaseClient, key: string) {
  const { data } = await db.from('app_settings').select('value').eq('key', key).maybeSingle();
  return data?.value || '';
}
export async function setSetting(db: SupabaseClient, key: string, value: string) {
  await db.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() });
}
