'use client';
import { useEffect, useState } from 'react';

// Application form opened inside LINE (LIFF). Env: NEXT_PUBLIC_LIFF_ID.
// LINE identifies the applicant (ID token); the server checks the token before saving.

type Liff = {
  init(o: { liffId: string }): Promise<void>;
  isLoggedIn(): boolean; login(o?: { redirectUri?: string }): void;
  getIDToken(): string | null; getProfile(): Promise<{ displayName: string }>;
  isInClient(): boolean; closeWindow(): void;
};
declare global { interface Window { liff?: Liff } }

const EDITOR_POS = ['Offline Editor', 'Online Editor / Finishing', 'Colorist', 'Motion Graphics', 'Sound Editor'];
const CREW_POS = ['Director of Photography', 'Camera Assistant', 'Gaffer', 'Grip', 'Art Director', 'Props Master', 'Wardrobe / Stylist', 'Make-up / Hair', 'Sound Recordist', 'Production Assistant (PA)', 'Location Manager'];

function loadSdk(): Promise<Liff> {
  return new Promise((ok, fail) => {
    if (window.liff) return ok(window.liff);
    const s = document.createElement('script');
    s.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
    s.onload = () => (window.liff ? ok(window.liff) : fail(new Error('LIFF SDK')));
    s.onerror = () => fail(new Error('LIFF SDK'));
    document.head.appendChild(s);
  });
}

export default function Apply() {
  const [liff, setLiff] = useState<Liff | null>(null);
  const [state, setState] = useState<'loading' | 'form' | 'sending' | 'done' | 'error'>('loading');
  const [err, setErr] = useState('');
  const [f, setF] = useState({ role: 'editor', full_name: '', phone: '', email: '', position: '', portfolio_url: '', consent: false });
  const set = (k: keyof typeof f, v: string | boolean) => setF(p => ({ ...p, [k]: v }));

  useEffect(() => {
    const id = process.env.NEXT_PUBLIC_LIFF_ID;
    const role = new URLSearchParams(window.location.search).get('role');
    if (role === 'editor' || role === 'crew') set('role', role);
    if (!id) { setErr('ระบบยังไม่ได้ตั้งค่า LIFF (NEXT_PUBLIC_LIFF_ID)'); setState('error'); return; }
    loadSdk().then(async l => {
      await l.init({ liffId: id });
      if (!l.isLoggedIn()) { l.login({ redirectUri: window.location.href }); return; }
      setLiff(l);
      try { const p = await l.getProfile(); setF(x => ({ ...x, full_name: x.full_name || p.displayName })); } catch { /* name stays empty */ }
      setState('form');
    }).catch(() => { setErr('เปิดฟอร์มไม่สำเร็จ ปิดหน้านี้แล้วเปิดใหม่จากแชท LINE'); setState('error'); });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    if (!f.consent) { setErr('กรุณายินยอมให้เก็บข้อมูลก่อนส่ง'); return; }
    if (!/^https:\/\//.test(f.portfolio_url.trim())) { setErr('ลิงก์ผลงานต้องขึ้นต้นด้วย https://'); return; }
    setState('sending');
    const res = await fetch('/api/line/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, idToken: liff?.getIDToken() }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(j.error || 'ส่งไม่สำเร็จ ลองอีกครั้ง'); setState('form'); return; }
    setState('done');
  }

  const positions = f.role === 'editor' ? EDITOR_POS : CREW_POS;
  return (
    <main className="wrap" style={{ maxWidth: 520, paddingTop: 20, paddingBottom: 40 }}>
      <div style={{ background: 'var(--blue)', color: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 14 }}>
        <div style={{ fontWeight: 700, letterSpacing: '.08em', fontSize: 13 }}>HOOSE</div>
        <div style={{ fontWeight: 700, fontSize: 18, marginTop: 4 }}>ใบสมัคร{f.role === 'editor' ? 'นักตัดต่อ' : 'ทีมโปรดักชัน'}</div>
      </div>

      {state === 'loading' && <div className="card"><span className="mut">กำลังเปิดฟอร์ม…</span></div>}
      {state === 'error' && <div className="card"><b>เปิดฟอร์มไม่ได้</b><span className="mut">{err}</span></div>}
      {state === 'done' && (
        <div className="card" style={{ gap: 10 }}>
          <b style={{ fontSize: 16 }}>ส่งใบสมัครแล้ว</b>
          <span className="mut">ทีม HOOSE จะตรวจผลงานและแจ้งขั้นถัดไปในแชท LINE</span>
          {liff?.isInClient() && <button className="btn p" onClick={() => liff.closeWindow()}>กลับไปที่แชท</button>}
        </div>
      )}
      {(state === 'form' || state === 'sending') && (
        <form className="card" onSubmit={submit}>
          <div className="seg" role="group" aria-label="บทบาท" style={{ alignSelf: 'flex-start' }}>
            <button type="button" className={f.role === 'editor' ? 'on' : ''} onClick={() => { set('role', 'editor'); set('position', ''); }}>นักตัดต่อ</button>
            <button type="button" className={f.role === 'crew' ? 'on' : ''} onClick={() => { set('role', 'crew'); set('position', ''); }}>ทีมโปรดักชัน</button>
          </div>
          <label className="f">ชื่อ-นามสกุล<input className="in-t" required value={f.full_name} onChange={e => set('full_name', e.target.value)} autoComplete="name" /></label>
          <label className="f">เบอร์โทร<input className="in-t" required type="tel" inputMode="tel" value={f.phone} onChange={e => set('phone', e.target.value)} placeholder="08x xxx xxxx" autoComplete="tel" /></label>
          <label className="f">อีเมล<input className="in-t" required type="email" value={f.email} onChange={e => set('email', e.target.value)} autoComplete="email" /></label>
          <label className="f">ตำแหน่ง
            <input className="in-t" required list="pos" value={f.position} onChange={e => set('position', e.target.value)} placeholder="เลือกหรือพิมพ์เอง" />
            <datalist id="pos">{positions.map(p => <option key={p} value={p} />)}</datalist>
          </label>
          <label className="f">ลิงก์ผลงาน (Portfolio / Showreel)<input className="in-t" required type="url" value={f.portfolio_url} onChange={e => set('portfolio_url', e.target.value)} placeholder="https://" /></label>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.5 }}>
            <input type="checkbox" checked={f.consent} onChange={e => set('consent', e.target.checked)} style={{ marginTop: 3 }} />
            <span>ยินยอมให้ HOOSE เก็บและใช้ข้อมูลข้างต้นเพื่อพิจารณารับสมัครและติดต่องาน ตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล (PDPA) ขอลบข้อมูลได้ทุกเมื่อทางแชทนี้</span>
          </label>
          {err && <span role="alert" style={{ color: 'var(--blue)', fontWeight: 600, fontSize: 13 }}>{err}</span>}
          <button className="btn p" disabled={state === 'sending'}>{state === 'sending' ? 'กำลังส่ง…' : 'ส่งใบสมัคร'}</button>
        </form>
      )}
    </main>
  );
}
