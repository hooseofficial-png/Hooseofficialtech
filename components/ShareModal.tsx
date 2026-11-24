'use client';
import { useEffect, useState } from 'react';
import Modal from './Modal';
import { useProject } from './ProjectProvider';
import { sb } from '@/lib/supabase/client';
import { copyText } from '@/lib/ui';
import { dateRange, lineShare } from '@/lib/domain';

export default function ShareModal({ onClose }: { onClose: () => void }) {
  const { id, data, act } = useProject();
  const [token, setToken] = useState('');
  useEffect(() => { sb().rpc('my_share_token', { pid: id }).then(({ data: t }) => setToken((t as string) || '')); }, [id]);
  if (!data) return null;
  const p = data.project;
  const site = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  const link = token ? `${site}/s/${token}` : '';
  const txt = `${p.name || 'โปรเจกต์'} · สรุปผลโปรเจกต์${p.start_date ? ' · ถ่าย ' + dateRange(p) : ''}\n${link}`;
  const set = (patch: Record<string, unknown>) => act(() => sb().from('projects').update(patch).eq('id', id));
  const Toggle = ({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) => (
    <button type="button" onClick={onClick} style={{ all: 'unset', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 0' }}>
      <span className={'chk' + (on ? ' on' : '')}>{on ? '✓' : ''}</span><span className="grow">{label}</span>
    </button>
  );
  return (
    <Modal title="แชร์สรุปผลให้ทีม" onClose={onClose}>
      <Toggle on={p.share_enabled} label="เปิดลิงก์แชร์ (คนที่มีลิงก์ดูได้ ไม่ต้องเข้าสู่ระบบ)" onClick={() => set({ share_enabled: !p.share_enabled })} />
      <Toggle on={p.share_budget} label="แสดงงบประมาณในหน้าที่แชร์" onClick={() => set({ share_budget: !p.share_budget })} />
      {p.share_enabled && link ? (
        <>
          <div className="row"><input className="in-t" readOnly value={link} aria-label="ลิงก์แชร์" /><button className="btn p" onClick={() => copyText(link, 'คัดลอกลิงก์แล้ว')}>คัดลอก</button></div>
          <div className="row w">
            <a className="btn k" href={lineShare(txt)} target="_blank" rel="noopener noreferrer">แชร์ทาง LINE</a>
            <a className="btn" href={link} target="_blank" rel="noopener noreferrer">ดูหน้าที่ทีมเห็น</a>
            <button className="btn ghost" onClick={async () => { const { data: t } = await sb().rpc('rotate_share_token', { pid: id }); if (t) setToken(t as string); }}>สร้างลิงก์ใหม่ (ลิงก์เดิมใช้ไม่ได้)</button>
          </div>
        </>
      ) : <p className="mut" style={{ margin: 0 }}>ลิงก์ปิดอยู่ คนที่มีลิงก์เดิมจะเปิดไม่ได้</p>}
      <p className="mut" style={{ fontSize: 12, margin: 0 }}>ลิงก์นี้เปิดได้เฉพาะหน้าสรุปผลของโปรเจกต์นี้ ดูได้อย่างเดียว · ถ้าต้องการให้ใครแก้ไขได้ ให้เชิญเป็นสมาชิกในแท็บ “สมาชิก”</p>
    </Modal>
  );
}
