'use client';
import { useState } from 'react';
import { sb } from '@/lib/supabase/client';
import { POSITIONS } from '@/lib/domain';

type Mode = 'password' | 'signup' | 'link';

const th = (m: string) =>
  /invalid login/i.test(m) ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
  : /email not confirmed/i.test(m) ? 'ยังไม่ได้ยืนยันอีเมล เปิดอีเมลยืนยันแล้วกดลิงก์ก่อน หรือกด “ส่งอีเมลยืนยันอีกครั้ง”'
  : /already registered|already exists/i.test(m) ? 'อีเมลนี้สมัครไว้แล้ว ไปที่แท็บ “เข้าสู่ระบบ” ได้เลย'
  : /rate limit/i.test(m) ? 'ส่งอีเมลเกินจำนวนที่ระบบอนุญาตต่อชั่วโมง รอสักครู่แล้วลองใหม่'
  : /password/i.test(m) && /least|short|weak/i.test(m) ? 'รหัสผ่านสั้นหรือเดาง่ายเกินไป ใช้อย่างน้อย 8 ตัวอักษร'
  : m;

export default function Login() {
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [prof, setProf] = useState({ full_name: '', position: '', company: '', phone: '' });
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'confirm' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const next = () => (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('next')) || '/';
  const site = () => process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
  const em = () => email.trim().toLowerCase();
  const fail = (m: string) => { setState('error'); setMsg(th(m)); };

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setState('busy'); setMsg('');
    if (mode === 'password') {
      const { error } = await sb().auth.signInWithPassword({ email: em(), password });
      if (error) return fail(error.message);
      window.location.href = next(); return;
    }
    if (mode === 'signup') {
      if (!prof.full_name.trim()) return fail('กรอกชื่อ-นามสกุล');
      if (!prof.position) return fail('เลือกตำแหน่ง');
      if (!prof.company.trim()) return fail('กรอกชื่อบริษัท');
      if (password.length < 8) return fail('รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร');
      if (password !== password2) return fail('รหัสผ่านสองช่องไม่ตรงกัน');
      const { data, error } = await sb().auth.signUp({
        email: em(), password,
        options: {
          emailRedirectTo: site() + '/auth/callback?next=' + encodeURIComponent('/account?welcome=1'),
          data: { full_name: prof.full_name.trim(), position: prof.position, company: prof.company.trim(), phone: prof.phone.trim() }
        }
      });
      if (error) return fail(error.message);
      // Supabase returns a user with no identities when the e-mail is already registered.
      if (data.user && data.user.identities && data.user.identities.length === 0) return fail('already registered');
      if (data.session) { window.location.href = '/account?welcome=1'; return; }
      setState('confirm'); return;
    }
    const { error } = await sb().auth.signInWithOtp({ email: em(), options: { shouldCreateUser: false, emailRedirectTo: site() + '/auth/callback?next=' + encodeURIComponent(next()) } });
    if (error) return fail(/signups not allowed|not found/i.test(error.message) ? 'ยังไม่มีบัญชีด้วยอีเมลนี้ ไปที่แท็บ “สมัครสมาชิก” ก่อน' : error.message);
    setState('sent');
  }

  async function resend() {
    setState('busy');
    const { error } = await sb().auth.resend({ type: 'signup', email: em(), options: { emailRedirectTo: site() + '/auth/callback?next=' + encodeURIComponent('/account?welcome=1') } });
    if (error) fail(error.message); else setState('confirm');
  }

  const tab = (m: Mode, label: string) => <button type="button" className={mode === m ? 'on' : ''} onClick={() => { setMode(m); setState('idle'); setMsg(''); }}>{label}</button>;

  return (
    <main className="login">
      <form className="card" onSubmit={submit}>
        <img src="/hoose-logo.png" alt="HOOSE" style={{ height: 44, alignSelf: 'flex-start' }} />
        <h1>{mode === 'signup' ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}</h1>
        <div className="seg" role="tablist" aria-label="เข้าสู่ระบบหรือสมัคร">
          {tab('password', 'เข้าสู่ระบบ')}{tab('signup', 'สมัครสมาชิก')}{tab('link', 'ลิงก์ทางอีเมล')}
        </div>
        {state === 'confirm' ? (
          <>
            <p>สมัครเรียบร้อย ส่งอีเมลยืนยันไปที่ <b>{email}</b> แล้ว เปิดอีเมลแล้วกด <b>Confirm</b> เพื่อเปิดใช้งานบัญชี จากนั้นเข้าสู่ระบบด้วยรหัสผ่านที่ตั้งไว้</p>
            <p className="mut" style={{ fontSize: 12, margin: 0 }}>ไม่เจออีเมล? ดูในโฟลเดอร์ Spam หรือ <button type="button" className="link-btn" onClick={resend}>ส่งอีเมลยืนยันอีกครั้ง</button></p>
            <button type="button" className="btn" onClick={() => { setMode('password'); setState('idle'); }}>ไปหน้าเข้าสู่ระบบ</button>
          </>
        ) : state === 'sent' ? (
          <p>ส่งลิงก์เข้าสู่ระบบไปที่ <b>{email}</b> แล้ว เปิดอีเมลแล้วกดลิงก์ (ลิงก์ใช้ได้ครั้งเดียว ถ้าไม่เจอให้ดูในโฟลเดอร์ Spam)</p>
        ) : (
          <>
            {mode === 'signup' && (
              <>
                <label className="f" htmlFor="su-name">ชื่อ-นามสกุล<input className="in-t" id="su-name" required autoComplete="name" value={prof.full_name} onChange={e => setProf({ ...prof, full_name: e.target.value })} /></label>
                <label className="f" htmlFor="su-pos">ตำแหน่ง
                  <select className="in-t" id="su-pos" required value={prof.position} onChange={e => setProf({ ...prof, position: e.target.value })}>
                    <option value="" disabled>เลือกตำแหน่ง</option>
                    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
                <label className="f" htmlFor="su-co">บริษัท / สังกัด<input className="in-t" id="su-co" required autoComplete="organization" value={prof.company} onChange={e => setProf({ ...prof, company: e.target.value })} placeholder="เช่น HOOSE Production Co., Ltd." /></label>
                <label className="f" htmlFor="su-ph">เบอร์โทร (ไม่บังคับ)<input className="in-t" id="su-ph" type="tel" autoComplete="tel" value={prof.phone} onChange={e => setProf({ ...prof, phone: e.target.value })} /></label>
              </>
            )}
            <label className="f" htmlFor="email">อีเมล
              <input className="in-t" id="email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
            </label>
            {mode !== 'link' && (
              <label className="f" htmlFor="pw">{mode === 'signup' ? 'ตั้งรหัสผ่าน (อย่างน้อย 8 ตัวอักษร)' : 'รหัสผ่าน'}
                <input className="in-t" id="pw" type="password" required minLength={mode === 'signup' ? 8 : undefined} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} />
              </label>
            )}
            {mode === 'signup' && (
              <label className="f" htmlFor="pw2">ยืนยันรหัสผ่าน
                <input className="in-t" id="pw2" type="password" required autoComplete="new-password" value={password2} onChange={e => setPassword2(e.target.value)} />
              </label>
            )}
            {state === 'error' && <div className="err" role="alert">{msg}{/ยืนยันอีเมล/.test(msg) && <> · <button type="button" className="link-btn" onClick={resend}>ส่งอีเมลยืนยันอีกครั้ง</button></>}</div>}
            <button className="btn p" disabled={state === 'busy'}>
              {state === 'busy' ? 'กำลังดำเนินการ…' : mode === 'password' ? 'เข้าสู่ระบบ' : mode === 'signup' ? 'สมัครสมาชิก' : 'ส่งลิงก์เข้าสู่ระบบทางอีเมล'}
            </button>
            <p className="mut" style={{ fontSize: 12, margin: 0 }}>
              {mode === 'password' ? <>ใช้งานครั้งแรก? <button type="button" className="link-btn" onClick={() => { setMode('signup'); setState('idle'); }}>สมัครสมาชิก</button> ตั้งรหัสผ่านเอง แล้วยืนยันทางอีเมล</>
                : mode === 'signup' ? 'หลังกดสมัคร ระบบจะส่งอีเมลยืนยัน ต้องกดยืนยันก่อนจึงเข้าสู่ระบบได้ · คนที่ถูกเชิญเข้าโปรเจกต์จะเห็นโปรเจกต์นั้นทันที'
                : 'สำหรับบัญชีที่สมัครแล้ว ใช้ได้เมื่อลืมรหัสผ่าน แล้วไปตั้งใหม่ที่ “บัญชีของฉัน”'}
            </p>
          </>
        )}
      </form>
    </main>
  );
}
