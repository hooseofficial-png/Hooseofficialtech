'use client';
import { useState } from 'react';
import { useProject } from '@/components/ProjectProvider';
import { sb } from '@/lib/supabase/client';
import { toast } from '@/lib/ui';

/** Project title with an inline rename (✎). Enter saves, Esc cancels. */
export default function ProjectTitle({ hero = false }: { hero?: boolean }) {
  const { id, data, act } = useProject();
  const [edit, setEdit] = useState(false); const [v, setV] = useState('');
  if (!data) return null;
  const name = data.project.name || '';
  const locked = !!(data.project as { details_locked?: boolean }).details_locked;
  async function save() {
    const n = v.trim(); setEdit(false);
    if (n === name) return;
    if (!n) { toast('ชื่อโปรเจกต์ว่างไม่ได้'); return; }
    await act(() => sb().from('projects').update({ name: n }).eq('id', id), 'เปลี่ยนชื่อโปรเจกต์แล้ว');
  }
  if (edit) return (
    <input className={'in-t title-in' + (hero ? ' hero-in' : '')} autoFocus value={v} aria-label="ชื่อโปรเจกต์" placeholder="ตั้งชื่อโปรเจกต์"
      onChange={e => setV(e.target.value)} onBlur={save}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEdit(false); }} />
  );
  return (
    <div className={'row title-row' + (hero ? ' hero-title' : '')} style={{ minWidth: 0, gap: 6 }}>
      <h1 className="ell">{name || 'โปรเจกต์ไม่มีชื่อ'}</h1>
      <button className="btn sm ghost icon-btn" aria-label="แก้ไขชื่อโปรเจกต์" title={locked ? 'รายละเอียดถูกล็อก · ปลดล็อกที่หน้า “รายละเอียด” ก่อน' : 'แก้ไขชื่อโปรเจกต์'}
        onClick={() => { if (locked) { toast('รายละเอียดถูกยืนยันและล็อกไว้ · กด “แก้ไขรายละเอียด” ที่หน้ารายละเอียดก่อนเปลี่ยนชื่อ'); return; } setV(name); setEdit(true); }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M14 6l4 4"/></svg>
      </button>
    </div>
  );
}


