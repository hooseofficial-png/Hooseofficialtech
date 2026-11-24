'use client';
import { useEffect, useState } from 'react';
import TopBar from '@/components/TopBar';
import { sb } from '@/lib/supabase/client';
import { toast, errText } from '@/lib/ui';

export default function Account() {
  const [p, setP] = useState({ full_name: '', phone: '', line_id: '', email: '' }); const [uid, setUid] = useState('');
  useEffect(() => { sb().auth.getUser().then(async ({ data }) => { if (!data.user) return; setUid(data.user.id); const { data: r } = await sb().from('profiles').select('*').eq('id', data.user.id).maybeSingle(); if (r) setP(r); }); }, []);
  async function save(e: React.FormEvent) { e.preventDefault(); const { error } = await sb().from('profiles').update({ full_name: p.full_name, phone: p.phone, line_id: p.line_id }).eq('id', uid); toast(error ? errText(error) : 'บันทึกแล้ว'); }
  return (
    <><TopBar /><main className="wrap" style={{ maxWidth: 640 }}>
      <h1>บัญชีของฉัน</h1>
      <form className="card" onSubmit={save}>
        <label className="f">อีเมล<input className="in-t" value={p.email} disabled /></label>
        <label className="f" htmlFor="n">ชื่อที่แสดง<input className="in-t" id="n" value={p.full_name} onChange={e => setP({ ...p, full_name: e.target.value })} /></label>
        <label className="f" htmlFor="ph">เบอร์โทร<input className="in-t" id="ph" value={p.phone} onChange={e => setP({ ...p, phone: e.target.value })} /></label>
        <label className="f" htmlFor="li">LINE ID<input className="in-t" id="li" value={p.line_id} onChange={e => setP({ ...p, line_id: e.target.value })} /></label>
        <button className="btn p">บันทึก</button>
      </form>
    </main></>
  );
}
