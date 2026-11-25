'use client';
import { useState } from 'react';
import Modal from './Modal';
import { useProject } from './ProjectProvider';
import { sb } from '@/lib/supabase/client';
import { copyText, toast, errText } from '@/lib/ui';
import { dateRange, lineShare } from '@/lib/domain';

/** "แชร์ให้ทีม": the project's Party Code. Joining needs a HOOSE account + this code. */
export default function ShareModal({ onClose }: { onClose: () => void }) {
  const { id, data, reload } = useProject();
  const [code, setCode] = useState<string>(data?.project.party_code || '');
  if (!data) return null;
  const p = data.project;
  const site = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  const link = `${site}/join?code=${code}`;
  const txt = `เชิญเข้าร่วมโปรเจกต์ “${p.name || 'โปรเจกต์'}” บน HOOSE${p.start_date ? ' · ถ่าย ' + dateRange(p) : ''}\nParty Code: ${code}\nสมัคร/เข้าสู่ระบบแล้วใส่ Code ที่ ${link}`;
  async function rotate() {
    const { data: c, error } = await sb().rpc('rotate_party_code', { pid: id });
    if (error) { toast(errText(error)); return; }
    setCode(c as string); toast('สร้าง Party Code ใหม่แล้ว · Code เดิมใช้ไม่ได้อีก'); reload();
  }
  return (
    <Modal title="แชร์ให้ทีมด้วย Party Code" onClose={onClose}>
      <div className="party-show" aria-label="Party Code">
        {Array.from(code || '······').map((ch, i) => <span key={i} style={{ animationDelay: i * 0.05 + 's' }}>{ch}</span>)}
      </div>
      <div className="row w" style={{ justifyContent: 'center' }}>
        <button className="btn p" onClick={() => copyText(code, 'คัดลอก Party Code แล้ว')}>คัดลอก Code</button>
        <button className="btn" onClick={() => copyText(txt, 'คัดลอกข้อความเชิญแล้ว')}>คัดลอกข้อความเชิญ</button>
        <a className="btn k" href={lineShare(txt)} target="_blank" rel="noopener noreferrer">ส่งทาง LINE</a>
      </div>
      <ul className="party-rules">
        <li>คนที่จะเข้าร่วมต้อง<b>มีบัญชี HOOSE</b> แล้วกด “เข้าร่วมด้วย Party Code” ที่หน้าภาพรวม</li>
        <li>เข้าร่วมแล้วเป็น <b>Viewer</b> เห็นสรุปผล ตารางนัด ทีมงาน เอกสาร <b>แต่ไม่เห็นงบประมาณ</b></li>
        <li>ให้ใครแก้ไขงานได้ เปลี่ยนเป็น <b>Editor</b> ที่แท็บ “สมาชิก”</li>
      </ul>
      <button className="link-btn sm" onClick={rotate}>Code หลุดไปที่อื่น? สร้าง Code ใหม่ (Code เดิมใช้ไม่ได้)</button>
    </Modal>
  );
}
