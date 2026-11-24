'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { sb, BUCKET } from '@/lib/supabase/client';
import { fromSummaryJson, type ProjectData, type Role, type DocCategory } from '@/lib/domain';
import { toast, errText } from '@/lib/ui';

interface Ctx {
  id: string; role: Role | null; data: ProjectData | null; loading: boolean; missing: boolean;
  reload: () => Promise<void>;
  /** Run a write, show an error toast if it fails, then reload. Returns true on success. */
  act: (fn: () => PromiseLike<{ error: unknown }>, ok?: string) => Promise<boolean>;
  upload: (file: File, folder: string) => Promise<{ path: string; name: string; size: number } | null>;
  openFile: (path: string | null, url?: string | null) => Promise<void>;
  signed: (path: string | null) => string;
}
const C = createContext<Ctx | null>(null);
export const useProject = () => { const c = useContext(C); if (!c) throw new Error('useProject outside provider'); return c; };

const safeName = (n: string) => n.normalize('NFKD').replace(/[^\w.\-ก-๙]+/g, '_').slice(-80);

export async function loadFull(id: string): Promise<ProjectData | null> {
  const s = sb();
  const [p, crew, ev, cats, files, bud, lines, ann] = await Promise.all([
    s.from('projects').select('*').eq('id', id).maybeSingle(),
    s.from('crew_positions').select('*').eq('project_id', id).order('sort').order('created_at'),
    s.from('events').select('*').eq('project_id', id),
    s.from('doc_categories').select('*').eq('project_id', id).order('sort').order('created_at'),
    s.from('doc_files').select('*').eq('project_id', id).order('created_at'),
    s.from('budgets').select('*').eq('project_id', id).maybeSingle(),
    s.from('budget_lines').select('*').eq('project_id', id).order('sort').order('created_at'),
    s.from('announcements').select('id,status,created_at,position_ids,message').eq('project_id', id).order('created_at')
  ]);
  if (!p.data) return null;
  const docs: DocCategory[] = (cats.data || []).map((c: any) => ({ id: c.id, title: c.title, sort: c.sort, files: (files.data || []).filter((f: any) => f.category_id === c.id) }));
  return {
    project: p.data, crew: crew.data || [], events: ev.data || [], docs,
    budget: bud.data || { project_id: id, total: 0, crew_alloc: 0, crew_alloc_draft: false, drafted: false },
    lines: lines.data || [], announcements: (ann.data || []).map((a: any) => ({ ...a, positions: (a.position_ids || []).length })), withMoney: true
  };
}

export default function ProjectProvider({ id, children }: { id: string; children: React.ReactNode }) {
  const [role, setRole] = useState<Role | null>(null);
  const [data, setData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const urls = useRef<Record<string, string>>({});
  const [, bump] = useState(0);

  const reload = useCallback(async () => {
    const s = sb();
    const { data: r } = await s.rpc('my_role', { pid: id });
    if (!r) { setMissing(true); setLoading(false); return; }
    setRole(r as Role);
    if (r === 'viewer') {
      const { data: j } = await s.rpc('project_summary', { pid: id });
      setData(j ? fromSummaryJson(j) : null); if (!j) setMissing(true);
    } else {
      const d = await loadFull(id); setData(d); if (!d) setMissing(true);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  // Live updates: another teammate's change reloads this page's data.
  useEffect(() => {
    if (!role || role === 'viewer') return;
    let t: ReturnType<typeof setTimeout>;
    const later = () => { clearTimeout(t); t = setTimeout(() => { if (!document.querySelector('input:focus,textarea:focus')) reload(); }, 600); };
    const ch = sb().channel('project-' + id);
    ['crew_positions', 'events', 'doc_categories', 'doc_files', 'budgets', 'budget_lines', 'announcements'].forEach(table =>
      ch.on('postgres_changes', { event: '*', schema: 'public', table, filter: 'project_id=eq.' + id }, later));
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: 'id=eq.' + id }, later).subscribe();
    return () => { clearTimeout(t); sb().removeChannel(ch); };
  }, [role, id, reload]);

  const act = useCallback(async (fn: () => PromiseLike<{ error: unknown }>, ok?: string) => {
    const { error } = await fn();
    if (error) { toast(errText(error)); await reload(); return false; }
    if (ok) toast(ok);
    await reload(); return true;
  }, [reload]);

  const upload = useCallback(async (file: File, folder: string) => {
    if (file.size > 50 * 1024 * 1024) { toast('ไฟล์ใหญ่เกิน 50 MB'); return null; }
    const path = `projects/${id}/${folder}/${crypto.randomUUID()}-${safeName(file.name)}`;
    const { error } = await sb().storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (error) { toast('อัปโหลดไม่สำเร็จ: ' + errText(error)); return null; }
    return { path, name: file.name, size: file.size };
  }, [id]);

  const openFile = useCallback(async (path: string | null, url?: string | null) => {
    if (!path) { if (url) window.open(url, '_blank', 'noopener'); return; }
    const w = window.open('', '_blank');
    const { data: s, error } = await sb().storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error || !s) { w?.close(); toast('เปิดไฟล์ไม่ได้: ' + errText(error)); return; }
    if (w) w.location.href = s.signedUrl; else window.location.href = s.signedUrl;
  }, []);

  // Signed URL for images (logo); cached per path, refreshed by re-render.
  const signed = useCallback((path: string | null) => {
    if (!path) return '';
    if (urls.current[path] === undefined) {
      urls.current[path] = '';
      sb().storage.from(BUCKET).createSignedUrl(path, 3600).then(({ data: s }) => { if (s) { urls.current[path] = s.signedUrl; bump(x => x + 1); } });
    }
    return urls.current[path];
  }, []);

  return <C.Provider value={{ id, role, data, loading, missing, reload, act, upload, openFile, signed }}>{children}</C.Provider>;
}
