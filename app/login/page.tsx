'use client';
import { useEffect, useRef, useState } from 'react';
import { sb } from '@/lib/supabase/client';

type Screen = 'signin' | 'signup' | 'verify' | 'forgot' | 'sent';
const CODE_LEN = 6;

const th = (m: string) =>
  /invalid login/i.test(m) ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
  : /already registered|already exists/i.test(m) ? 'อีเมลนี้สมัครไว้แล้ว เข้าสู่ระบบได้เลย'
  : /rate limit|too many/i.test(m) ? 'ส่งอีเมลถี่เกินไป รอสักครู่แล้วลองใหม่'
  : /expired|invalid.*(token|otp)|token.*invalid/i.test(m) ? 'รหัสไม่ถูกต้องหรือหมดอายุ กด “ส่งรหัสอีกครั้ง”'
  : /password/i.test(m) && /least|short|weak/i.test(m) ? 'รหัสผ่านสั้นหรือเดาง่ายเกินไป ใช้อย่างน้อย 8 ตัวอักษร'
  : /signups not allowed|user not found/i.test(m) ? 'ยังไม่มีบัญชีด้วยอีเมลนี้ สมัครสมาชิกก่อน'
  : m;

function GoogleIcon() {
  return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2.1 5-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.1z"/><path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.6-3.8-12.3-9H4.4v5.7C8 41.1 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.7 28.3c-.4-1.3-.7-2.8-.7-4.3s.3-3 .7-4.3V14H4.4C2.9 17 2 20.4 2 24s.9 7 2.4 10l7.3-5.7z"/><path fill="#EA4335" d="M24 10.7c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.1 29.9 2 24 2 15.4 2 8 6.9 4.4 14l7.3 5.7c1.7-5.2 6.6-9 12.3-9z"/></svg>;
}
function Eye({ on }: { on: boolean }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>{!on && <path d="M3 3l18 18"/>}</svg>;
}

function CodeInput({ value, onChange, onComplete }: { value: string; onChange: (v: string) => void; onComplete: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => { refs.current[0]?.focus(); }, []);
  const set = (v: string) => { const d = v.replace(/\D/g, '').slice(0, CODE_LEN); onChange(d); if (d.length === CODE_LEN) onComplete(d); return d; };
  return (
    <div className="otp" role="group" aria-label={`รหัสยืนยัน ${CODE_LEN} หลัก`}>
      {Array.from({ length: CODE_LEN }, (_, i) => (
        <input key={i} ref={el => { refs.current[i] = el; }} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'}
          className={value[i] ? 'on' : ''} value={value[i] || ''} aria-label={`หลักที่ ${i + 1}`}
          onFocus={e => e.target.select()}
          onChange={e => {
            const d = e.target.value.replace(/\D/g, '');
            if (!d) { set(value.slice(0, i) + value.slice(i + 1)); return; }
            const digits = d.length > 1 && value[i] && d.length === 2 ? d.replace(value[i], '') || d[0] : d;
            const nv = set(value.slice(0, i) + digits + value.slice(i + digits.length));
            refs.current[Math.min(i + digits.length, CODE_LEN - 1, nv.length)]?.focus();
          }}
          onKeyDown={e => { if (e.key === 'Backspace' && !value[i] && i > 0) refs.current[i - 1]?.focus(); if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus(); if (e.key === 'ArrowRight' && i < CODE_LEN - 1) refs.current[i + 1]?.focus(); }}
          onPaste={e => { e.preventDefault(); const d = set(e.clipboardData.getData('text')); refs.current[Math.min(d.length, CODE_LEN - 1)]?.focus(); }} />
      ))}
    </div>
  );
}

export default function Login() {
  const [screen, setScreen] = useState<Screen>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [cool, setCool] = useState(0);
  const [next, setNext] = useState('/');
  const googleOn = process.env.NEXT_PUBLIC_GOOGLE_LOGIN === '1';

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('next')?.startsWith('/')) setNext(q.get('next')!);
    if (q.get('email')) setEmail(q.get('email')!);
    if (q.get('mode') === 'signup') setScreen('signup');
  }, []);
  useEffect(() => { if (cool <= 0) return; const t = setTimeout(() => setCool(cool - 1), 1000); return () => clearTimeout(t); }, [cool]);

  const site = () => process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
  const em = () => email.trim().toLowerCase();
  const go = (s: Screen) => { setScreen(s); setMsg(''); setCode(''); };
  const callback = (to: string) => site() + '/auth/callback?next=' + encodeURIComponent(to);

  async function signin(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg('');
    const { error } = await sb().auth.signInWithPassword({ email: em(), password });
    setBusy(false);
    if (error) {
      if (/email not confirmed/i.test(error.message)) { await resend(); go('verify'); return; }
      setMsg(th(error.message)); return;
    }
    window.location.href = next;
  }
  async function signup(e: React.FormEvent) {
    e.preventDefault(); setMsg('');
    if (password.length < 8) { setMsg('รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร'); return; }
    setBusy(true);
    const { data, error } = await sb().auth.signUp({ email: em(), password, options: { emailRedirectTo: callback('/welcome?next=' + encodeURIComponent(next)), data: { full_name: name.trim() } } });
    setBusy(false);
    if (error) { setMsg(th(error.message)); return; }
    if (data.user && data.user.identities && data.user.identities.length === 0) { setMsg(th('already registered')); return; }
    if (data.session) { window.location.href = '/welcome?next=' + encodeURIComponent(next); return; }
    setCool(60); go('verify');
  }
  async function verify(token = code) {
    if (token.length !== CODE_LEN) return;
    setBusy(true); setMsg('');
    const { error } = await sb().auth.verifyOtp({ email: em(), token, type: 'signup' });
    if (error) { const r = await sb().auth.verifyOtp({ email: em(), token, type: 'email' }); if (r.error) { setBusy(false); setMsg(th(error.message)); setCode(''); return; } }
    window.location.href = '/welcome?next=' + encodeURIComponent(next);
  }
  async function resend() {
    if (cool > 0) return;
    const { error } = await sb().auth.resend({ type: 'signup', email: em(), options: { emailRedirectTo: callback('/welcome?next=' + encodeURIComponent(next)) } });
    if (error) setMsg(th(error.message)); else { setCool(60); setMsg(''); }
  }
  async function forgot(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg('');
    const { error } = await sb().auth.signInWithOtp({ email: em(), options: { shouldCreateUser: false, emailRedirectTo: callback('/account?reset=1') } });
    setBusy(false);
    if (error) setMsg(th(error.message)); else go('sent');
  }
  async function google() {
    setBusy(true);
    const { error } = await sb().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback(next) } });
    if (error) { setBusy(false); setMsg(th(error.message)); }
  }

  const GoogleBtn = googleOn ? <>
    <button type="button" className="btn g-btn" onClick={google} disabled={busy}><GoogleIcon />ดำเนินการต่อด้วย Google</button>
    <div className="or"><span>หรือ</span></div>
  </> : null;
  const pwField = (auto: string) => (
    <div className="pw-wrap">
      <input className="in-t" type={show ? 'text' : 'password'} required minLength={screen === 'signup' ? 8 : undefined} autoComplete={auto} value={password} onChange={e => setPassword(e.target.value)} placeholder={screen === 'signup' ? 'ตั้งรหัสผ่าน (อย่างน้อย 8 ตัว)' : 'รหัสผ่าน'} aria-label="รหัสผ่าน" />
      <button type="button" className="eye" onClick={() => setShow(!show)} aria-label={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}><Eye on={show} /></button>
    </div>
  );
  const err = msg && <div className="err" role="alert">{msg}</div>;
  const signupValid = name.trim() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em()) && password.length >= 8;

  return (
    <main className="auth">
      <div className="auth-glow" aria-hidden="true" />
      <div className="auth-box" key={screen}>
        <img src="/hoose-logo.png" alt="HOOSE" className="auth-logo" />

        {screen === 'signin' && <form onSubmit={signin} className="auth-form">
          <h1>ยินดีต้อนรับกลับ</h1>
          <p className="auth-sub">ยังไม่มีบัญชี? <button type="button" className="link-btn" onClick={() => go('signup')}>สมัครสมาชิก</button></p>
          {GoogleBtn}
          <input className="in-t" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="อีเมลที่ทำงาน" aria-label="อีเมล" />
          {pwField('current-password')}
          {err}
          <button className="btn p lg" disabled={busy}>{busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}</button>
          <button type="button" className="link-btn sm" onClick={() => go('forgot')}>ลืมรหัสผ่าน?</button>
        </form>}

        {screen === 'signup' && <form onSubmit={signup} className="auth-form">
          <h1>สมัครใช้งานในไม่กี่วินาที</h1>
          <p className="auth-sub">มีบัญชีแล้ว? <button type="button" className="link-btn" onClick={() => go('signin')}>เข้าสู่ระบบ</button></p>
          {GoogleBtn}
          <input className="in-t" required autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="ชื่อ-นามสกุล" aria-label="ชื่อ-นามสกุล" autoFocus />
          <input className="in-t" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="อีเมลที่ทำงาน" aria-label="อีเมล" />
          {pwField('new-password')}
          {err}
          <button className="btn p lg" disabled={busy || !signupValid}>{busy ? 'กำลังสมัคร…' : 'สมัครด้วยอีเมล'}</button>
          <p className="auth-fine">ขั้นต่อไป: ยืนยันอีเมลด้วยรหัส 6 หลัก แล้วตั้งค่าตำแหน่งและทีมของคุณ</p>
        </form>}

        {screen === 'verify' && <div className="auth-form">
          <h1>ยืนยันอีเมลของคุณ</h1>
          <CodeInput value={code} onChange={setCode} onComplete={v => verify(v)} />
          <p className="auth-sub" style={{ margin: 0 }}>กรอกรหัสที่ส่งไปที่<br /><b style={{ color: 'var(--ink)' }}>{email}</b></p>
          {err}
          <button className="btn k lg" onClick={() => verify()} disabled={busy || code.length !== CODE_LEN}>{busy ? 'กำลังยืนยัน…' : 'ยืนยัน'}</button>
          <p className="auth-sub">ไม่ได้รับรหัส? {cool > 0 ? <span className="mut">ส่งอีกครั้งได้ใน {cool} วินาที</span> : <button type="button" className="link-btn" onClick={resend}>ส่งรหัสอีกครั้ง</button>} หรือ <button type="button" className="link-btn" onClick={() => go('signup')}>เปลี่ยนอีเมล</button></p>
          <p className="auth-fine">ยังไม่ได้? ดูในโฟลเดอร์ Spam / Promotions · หรือกดปุ่มยืนยันในอีเมลก็ได้</p>
        </div>}

        {screen === 'forgot' && <form onSubmit={forgot} className="auth-form">
          <h1>ลืมรหัสผ่าน</h1>
          <p className="auth-sub">เราจะส่งลิงก์เข้าสู่ระบบไปที่อีเมล แล้วตั้งรหัสผ่านใหม่ที่ “บัญชีของฉัน”</p>
          <input className="in-t" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="อีเมล" aria-label="อีเมล" autoFocus />
          {err}
          <button className="btn p lg" disabled={busy}>{busy ? 'กำลังส่ง…' : 'ส่งลิงก์เข้าสู่ระบบ'}</button>
          <button type="button" className="link-btn sm" onClick={() => go('signin')}>กลับไปหน้าเข้าสู่ระบบ</button>
        </form>}

        {screen === 'sent' && <div className="auth-form">
          <h1>เช็กอีเมลของคุณ</h1>
          <p className="auth-sub">ส่งลิงก์ไปที่ <b style={{ color: 'var(--ink)' }}>{email}</b> แล้ว กดลิงก์ในอีเมลเพื่อเข้าสู่ระบบ (ใช้ได้ครั้งเดียว)</p>
          <button type="button" className="btn lg" onClick={() => go('signin')}>กลับไปหน้าเข้าสู่ระบบ</button>
        </div>}
      </div>
    </main>
  );
}
