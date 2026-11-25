'use client';
import { useEffect, useState } from 'react';
import { sb } from '@/lib/supabase/client';
import { PROJECT_POSITIONS, POSITION_DESC, ROLE_TH } from '@/lib/domain';
import { toast } from '@/lib/ui';

/** "ตำแหน่งของคุณในโปรเจกต์นี้" — always visible under the project title; change it in place. */
export default function MyPosition({ projectId }: { projectId: string }) {
  const [m, setM] = useState<{ role: string; pos: string } | null>(null);
  const [edit, setEdit] = useState(false);
  useEffect(() => {
    sb().rpc('my_membership', { pid: projectId }).then(({ data }) => {
      const r = ((data as { role: string; job_title: string; profile_title: string }[] | null) || [])[0];
      if (r) setM({ role: r.role, pos: r.job_title || r.profile_title || '' });
    });
  }, [projectId]);
  if (!m) return <div className="my-pos-line skel-line" />;
  async function change(pos: string) {
    setEdit(false); if (pos === m!.pos) return;
    setM({ ...m!, pos });
    const { error } = await sb().rpc('set_my_position', { pid: projectId, pos });
    toast(error ? 'บันทึกไม่สำเร็จ' : 'เปลี่ยนตำแหน่งในโปรเจกต์นี้เป็น ' + (pos || '—') + ' แล้ว');
  }
  const isPM = m.pos === 'Production Manager';
  return (
    <div className="my-pos-line">
      <span className="cap">ตำแหน่งของคุณ</span>
      {edit ? (
        <select className="in-t" autoFocus value={m.pos} onChange={e => change(e.target.value)} onBlur={() => setEdit(false)} aria-label="ตำแหน่งของคุณในโปรเจกต์นี้" style={{ height: 34, width: 'auto' }}>
          <option value="">ยังไม่ระบุ</option>
          {PROJECT_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      ) : (
        <button className="pos-tag lg pos-btn" onClick={() => setEdit(true)} title="เปลี่ยนตำแหน่งในโปรเจกต์นี้">{m.pos || 'ยังไม่ระบุตำแหน่ง'} <span aria-hidden="true">▾</span></button>
      )}
      <span className="chip">{ROLE_TH[m.role] || m.role}</span>
      {!isPM && <span className="mut my-pos-text">{m.pos ? <>ในโปรเจกต์นี้คุณทำหน้าที่ <b>{m.pos}</b>{POSITION_DESC[m.pos] ? ' · ' + POSITION_DESC[m.pos] : ''}</> : 'เลือกตำแหน่งของคุณในโปรเจกต์นี้ ทีมจะเห็นในแท็บสมาชิก'}</span>}
    </div>
  );
}
