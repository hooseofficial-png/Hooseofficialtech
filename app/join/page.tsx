'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import PartyCodeField from '@/components/PartyCodeField';
import { PROJECT_POSITIONS, POSITION_DESC, cleanCode } from '@/lib/domain';
import { getMe } from '@/lib/me';
import { joinWithCode } from '@/lib/party';
import { celebrate, navStart } from '@/lib/ui';

/** Join a project with its Party Code (account required — middleware sends guests to /login first). */
export default function Join() {
  const router = useRouter();
  const [code, setCode] = useState(''); const [pos, setPos] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get('code'); if (c) setCode(cleanCode(c));
    getMe().then(m => { if (m?.profile?.position) setPos(p => p || m.profile!.position); });
  }, []);
  async function join() {
    if (code.length !== 6) { setErr('Party Code มี 6 ตัวอักษร'); return; }
    setBusy(true); setErr('');
    try { const pid = await joinWithCode(code, pos); celebrate(); navStart(); setTimeout(() => router.push('/p/' + pid), 500); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <><TopBar /><main className="wrap" style={{ maxWidth: 560 }}>
      <section className="card join-card">
        <span className="tour-tag" style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}>Party Code</span>
        <h1>เข้าร่วมโปรเจกต์</h1>
        <p className="mut" style={{ margin: 0 }}>ใส่ Party Code 6 ตัวที่ได้จาก Production Manager หรือ Producer ของโปรเจกต์</p>
        <PartyCodeField value={code} onChange={v => { setCode(v); setErr(''); }} onEnter={join} autoFocus />
        <label className="f" htmlFor="j-pos">ตำแหน่งของคุณในโปรเจกต์นี้
          <select className="in-t" id="j-pos" value={pos} onChange={e => setPos(e.target.value)}>
            <option value="">เลือกตำแหน่ง</option>
            {PROJECT_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        {pos && <div className="hint">{POSITION_DESC[pos]}</div>}
        {err && <div className="err" role="alert">{err}</div>}
        <button className="btn p lg" onClick={join} disabled={busy || code.length !== 6}>{busy ? 'กำลังเข้าร่วม…' : 'เข้าร่วมโปรเจกต์'}</button>
        <p className="mut" style={{ fontSize: 12, margin: 0 }}>เข้าร่วมแล้วจะเห็นสรุปผลโปรเจกต์ (ไม่รวมงบประมาณ) · ถ้าต้องแก้ไขงาน ให้เจ้าของโปรเจกต์เปลี่ยนสิทธิ์เป็น Editor ในแท็บ “สมาชิก”</p>
      </section>
    </main></>
  );
}
