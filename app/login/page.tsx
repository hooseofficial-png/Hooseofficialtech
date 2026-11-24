'use client';
import { useState } from 'react';
import { sb } from '@/lib/supabase/client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  async function send(e: React.FormEvent) {
    e.preventDefault(); setState('sending');
    const next = new URLSearchParams(window.location.search).get('next') || '/';
    const site = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const { error } = await sb().auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { emailRedirectTo: site + '/auth/callback?next=' + encodeURIComponent(next) } });
    if (error) { setState('error'); setMsg(error.message); } else setState('sent');
  }
  return (
    <main className="login">
      <form className="card" onSubmit={send}>
        <img src="/hoose-logo.png" alt="HOOSE" style={{ height: 44, alignSelf: 'flex-start' }} />
        <h1>เข้าสู่ระบบ</h1>
        {state === 'sent' ? (
          <p>ส่งลิงก์เข้าสู่ระบบไปที่ <b>{email}</b> แล้ว เปิดอีเมลแล้วกดลิงก์เพื่อเข้าใช้งาน (ลิงก์ใช้ได้ครั้งเดียว)</p>
        ) : (
          <>
            <label className="f" htmlFor="email">อีเมล
              <input className="in-t" id="email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
            </label>
            {state === 'error' && <div className="err">ส่งลิงก์ไม่สำเร็จ: {msg}</div>}
            <button className="btn p" disabled={state === 'sending'}>{state === 'sending' ? 'กำลังส่ง…' : 'ส่งลิงก์เข้าสู่ระบบทางอีเมล'}</button>
            <p className="mut" style={{ fontSize: 12, margin: 0 }}>ไม่ต้องใช้รหัสผ่าน · คนที่ถูกเชิญเข้าโปรเจกต์จะเห็นโปรเจกต์นั้นทันทีหลังเข้าสู่ระบบ</p>
          </>
        )}
      </form>
    </main>
  );
}
