'use client';
import { useEffect, useState } from 'react';
import TopBar from '@/components/TopBar';
import { sb } from '@/lib/supabase/client';
import { toast, errText } from '@/lib/ui';

export default function Account() {
  const [p, setP] = useState({ full_name: '', phone: '', line_id: '', email: '' }); const [uid, setUid] = useState('');
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('');
  useEffect(() => { sb().auth.getUser().then(async ({ data }) => { if (!data.user) return; setUid(data.user.id); const { data: r } = await sb().from('profiles').select('*').eq('id', data.user.id).maybeSingle(); if (r) setP(r); }); }, []);
  async function save(e: React.FormEvent) { e.preventDefault(); const { error } = await sb().from('profiles').update({ full_name: p.full_name, phone: p.phone, line_id: p.line_id }).eq('id', uid); toast(error ? errText(error) : 'บันทึกแล้ว'); }
  async function setPassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) { toast('รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร'); return; }
    if (pw !== pw2) { toast('รหัสผ่านสองช่องไม่ตรงกัน'); return; }
    const { error } = await sb().auth.updateUser({ password: pw });
    if (error) toast(errText(error)); else { toast('ตั้งรหัสผ่านแล้ว · ครั้งหน้าเข้าสู่ระบบด้วยรหัสผ่านได้'); setPw(''); setPw2(''); }
  }
  return (
    <><TopBar /><main className="wrap" style={{ maxWidth: 640 }}>
      <h1>บัญชีของฉัน</h1>
      <form className="card" onSubmit={save}>
        <h2>ข้อมูลส่วนตัว</h2>
        <label className="f">อีเมล<input className="in-t" value={p.email} disabled /></label>
        <label className="f" htmlFor="n">ชื่อที่แสดง<input className="in-t" id="n" value={p.full_name} onChange={e => setP({ ...p, full_name: e.target.value })} /></label>
        <label className="f" htmlFor="ph">เบอร์โทร<input className="in-t" id="ph" value={p.phone} onChange={e => setP({ ...p, phone: e.target.value })} /></label>
        <label className="f" htmlFor="li">LINE ID<input className="in-t" id="li" value={p.line_id} onChange={e => setP({ ...p, line_id: e.target.value })} /></label>
        <button className="btn p">บันทึก</button>
      </form>
      <form className="card" onSubmit={setPassword}>
        <h2>รหัสผ่าน</h2>
        <span className="mut" style={{ fontSize: 13 }}>ตั้งรหัสผ่านเพื่อเข้าสู่ระบบได้ทันที ไม่ต้องรออีเมล</span>
        <label className="f" htmlFor="pw1">รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)<input className="in-t" id="pw1" type="password" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} /></label>
        <label className="f" htmlFor="pw2">ยืนยันรหัสผ่าน<input className="in-t" id="pw2" type="password" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} /></label>
        <button className="btn p">ตั้งรหัสผ่าน</button>
      </form>
    </main></>
  );
}
