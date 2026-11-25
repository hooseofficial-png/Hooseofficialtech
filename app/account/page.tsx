'use client';
import { useEffect, useState } from 'react';
import TopBar from '@/components/TopBar';
import CalendarSync from '@/components/CalendarSync';
import { sb } from '@/lib/supabase/client';
import { POSITIONS, POSITION_TH } from '@/lib/domain';
import { toast, errText } from '@/lib/ui';
import { currentUser } from '@/lib/me';

type Prof = { full_name: string; phone: string; line_id: string; email: string; position: string; company: string };
const GOOGLE_MSG: Record<string, string> = {
  connected: 'ADD เสร็จสิ้น · เชื่อมบัญชี Google Calendar แล้ว นัดใหม่จะส่งเข้า Google Calendar ของทีมอัตโนมัติ',
  denied: 'ยกเลิกการเชื่อม Google แล้ว (ไม่ได้กดอนุญาต)',
  not_configured: 'ผู้ดูแลระบบยังไม่ได้ตั้งค่า Google API (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)',
  error: 'เชื่อม Google ไม่สำเร็จ ลองอีกครั้ง'
};

export default function Account() {
  const [p, setP] = useState<Prof>({ full_name: '', phone: '', line_id: '', email: '', position: '', company: '' }); const [uid, setUid] = useState('');
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('');
  const [banner, setBanner] = useState('');
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const g = q.get('google'); const msg = (g && GOOGLE_MSG[g]) || (q.get('welcome') ? 'ยืนยันอีเมลเรียบร้อย ยินดีต้อนรับสู่ HOOSE' : q.get('reset') ? 'เข้าสู่ระบบแล้ว · ตั้งรหัสผ่านใหม่ในช่อง “รหัสผ่าน” ด้านล่าง' : '');
    if (msg) { setBanner(msg); toast(msg); window.history.replaceState(null, '', '/account'); }
    currentUser().then(async (user) => {
      if (!user) return; setUid(user.id);
      const { data: r } = await sb().from('profiles').select('full_name, phone, line_id, email, position, company').eq('id', user.id).maybeSingle();
      if (r) setP(r as Prof);
    });
  }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await sb().from('profiles').update({ full_name: p.full_name.trim(), phone: p.phone, line_id: p.line_id, position: p.position, company: p.company.trim() }).eq('id', uid);
    toast(error ? errText(error) : 'บันทึกแล้ว');
  }
  async function setPassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) { toast('รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร'); return; }
    if (pw !== pw2) { toast('รหัสผ่านสองช่องไม่ตรงกัน'); return; }
    const { error } = await sb().auth.updateUser({ password: pw });
    if (error) toast(errText(error)); else { toast('ตั้งรหัสผ่านแล้ว · ครั้งหน้าเข้าสู่ระบบด้วยรหัสผ่านได้'); setPw(''); setPw2(''); }
  }
  const initial = (p.full_name || p.email || '?')[0]?.toUpperCase();
  return (
    <><TopBar /><main className="wrap" style={{ maxWidth: 640 }}>
      <h1>บัญชีของฉัน</h1>
      {banner && <div className="notice" role="status">{banner}<button className="link-btn" onClick={() => setBanner('')} aria-label="ปิด">ปิด</button></div>}
      <section className="card id-card">
        <span className="av lg">{initial}</span>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="id-name ell">{p.full_name || 'ยังไม่ได้ตั้งชื่อ'}</div>
          <div className="row w" style={{ gap: 8, marginTop: 6 }}>
            {p.position ? <span className="pos-tag lg">{p.position}</span> : <span className="pos-tag lg ghost">ยังไม่ระบุตำแหน่ง</span>}
            {p.position && <span className="mut" style={{ fontSize: 13 }}>{POSITION_TH[p.position]}</span>}
          </div>
          <div className="mut ell" style={{ fontSize: 13, marginTop: 6 }}>{p.company || 'ยังไม่ระบุบริษัท'} · {p.email}</div>
        </div>
      </section>
      <form className="card" onSubmit={save}>
        <h2>ข้อมูลส่วนตัว</h2>
        <label className="f">อีเมล<input className="in-t" value={p.email} disabled /></label>
        <label className="f" htmlFor="n">ชื่อ-นามสกุล<input className="in-t" id="n" value={p.full_name} onChange={e => setP({ ...p, full_name: e.target.value })} /></label>
        <label className="f" htmlFor="pos">ตำแหน่ง
          <select className="in-t" id="pos" value={p.position} onChange={e => setP({ ...p, position: e.target.value })}>
            <option value="">ยังไม่ระบุ</option>
            {POSITIONS.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
        <label className="f" htmlFor="co">บริษัท / สังกัด<input className="in-t" id="co" value={p.company} onChange={e => setP({ ...p, company: e.target.value })} /></label>
        <label className="f" htmlFor="ph">เบอร์โทร<input className="in-t" id="ph" value={p.phone} onChange={e => setP({ ...p, phone: e.target.value })} /></label>
        <label className="f" htmlFor="li">LINE ID<input className="in-t" id="li" value={p.line_id} onChange={e => setP({ ...p, line_id: e.target.value })} /></label>
        <button className="btn p">บันทึก</button>
      </form>
      <CalendarSync variant="card" />
      <form className="card" onSubmit={setPassword}>
        <h2>รหัสผ่าน</h2>
        <span className="mut" style={{ fontSize: 13 }}>เปลี่ยนรหัสผ่านที่ใช้เข้าสู่ระบบ</span>
        <label className="f" htmlFor="pw1">รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)<input className="in-t" id="pw1" type="password" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} /></label>
        <label className="f" htmlFor="pw2">ยืนยันรหัสผ่าน<input className="in-t" id="pw2" type="password" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} /></label>
        <button className="btn p">เปลี่ยนรหัสผ่าน</button>
      </form>
    </main></>
  );
}
