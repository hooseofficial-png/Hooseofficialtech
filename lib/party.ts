'use client';
import { sb } from '@/lib/supabase/client';
import { clearCache } from '@/lib/cache';

/** Join a project with its Party Code. Returns the project id, or throws a Thai message. */
export async function joinWithCode(code: string, position?: string): Promise<string> {
  const { data, error } = await sb().rpc('join_project', { code, pos: position || null });
  if (error) throw new Error(error.message.replace(/^.*?:\s*/, '') || 'เข้าร่วมไม่สำเร็จ');
  clearCache(); // overview list must include the new project
  return data as string;
}
