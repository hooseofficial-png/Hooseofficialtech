'use client';
import { useState } from 'react';
import { sb } from '@/lib/supabase/client';

type Mode = 'password' | 'link';

export default function Login() {
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const next = () => (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('next')) || '/';

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setState('busy'); setMsg('');
    const em = email.trim().toLowerCase();
    if (mode === 'password') {
      const { error } = await sb().auth.signInWithPassword({ email: em, password });
      if (error) { setState('error'); setMsg(/invalid/i.test(error.message) ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : error.message); return; }
      window.location.href = next(); return;
    }
    const site = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const { error } = await sb().auth.signInWithOtp({ email: em, options: { emailRedirectTo: site + '/auth/callback?next=' + encodeURIComponent(next()) } });
    if (error) { setState('error'); setMsg(/rate limit/i.test(error.message) ? 'ส่งอีเมลเกินจำนวนที่ระบบอนุญาตต่อชั่วโมง ใช้การเข้าสู่ระบบด้วยรหัสผ่านแทน หรือรอสักครู่' : error.message); }
    else setState('sent');
  }

  return (
    <main className="login">
      <form className="card" onSubmit={submit}>
        <img src="/hoose-logo.png" alt="HOOSE" style={{ height: 44, alignSelf: 'flex-start' }} />
        <h1>เข้าสู่ระบบ</h1>
        <div className="seg" role="tablist" aria-label="วิธีเข้าสู่ระบบ">
          <button type="button" className={mode === 'password' ? 'on' : ''} onClick={() => { setMode('password'); setState('idle'); }}>รหัสผ่าน</button>
          <button type="button" className={mode === 'link' ? 'on' : ''} onClick={() => { setMode('link'); setState('idle'); }}>ลิงก์ทางอีเมล</button>
        </div>
        {state === 'sent' ? (
          <p>ส่งลิงก์เข้าสู่ระบบไปที่ <b>{email}</b> แล้ว เปิดอีเมลแล้วกดลิงก์ (ลิงก์ใช้ได้ครั้งเดียว ถ้าไม่เจอให้ดูในโฟลเดอร์ Spam)</p>
        ) : (
          <>
            <label className="f" htmlFor="email">อีเมล
              <input className="in-t" id="email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
            </label>
            {mode === 'password' && (
              <label className="f" htmlFor="pw">รหัสผ่าน
                <input className="in-t" id="pw" type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
              </label>
            )}
            {state === 'error' && <div className="err">{msg}</div>}
            <button className="btn p" disabled={state === 'busy'}>{state === 'busy' ? 'กำลังดำเนินการ…' : mode === 'password' ? 'เข้าสู่ระบบ' : 'ส่งลิงก์เข้าสู่ระบบทางอีเมล'}</button>
            <p className="mut" style={{ fontSize: 12, margin: 0 }}>
              {mode === 'password' ? 'ยังไม่มีรหัสผ่าน? เข้าด้วยลิงก์ทางอีเมลครั้งแรก แล้วตั้งรหัสผ่านที่ “บัญชีของฉัน” หรือขอผู้ดูแลระบบสร้างบัญชีให้' : 'คนที่ถูกเชิญเข้าโปรเจกต์จะเห็นโปรเจกต์นั้นทันทีหลังเข้าสู่ระบบ'}
            </p>
          </>
        )}
      </form>
    </main>
  );
}
