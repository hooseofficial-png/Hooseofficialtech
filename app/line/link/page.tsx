'use client';
import { useEffect, useState } from 'react';
import { sb } from '@/lib/supabase/client';

// Landing page of the "สร้างบัญชีกองถ่าย HOOSE" button in LINE.
// Not signed in → sign-up (then back here). Signed in → link this account to the LINE chat.
export default function LinkLine() {
  const [state, setState] = useState<'working' | 'done' | 'error'>('working');
  const [msg, setMsg] = useState(''); const [email, setEmail] = useState('');
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('t') || '';
    (async () => {
      const { data: { session } } = await sb().auth.getSession();
      if (!session) {
        window.location.href = '/login?mode=signup&next=' + encodeURIComponent('/line/link?t=' + encodeURIComponent(t));
        return;
      }
      const r = await fetch('/api/line/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t }) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) { window.location.href = '/login?next=' + encodeURIComponent('/line/link?t=' + encodeURIComponent(t)); return; }
      if (!r.ok) { setMsg(j.error || 'เชื่อมบัญชีไม่สำเร็จ'); setState('error'); return; }
      setEmail(j.email || ''); setState('done');
    })();
  }, []);
  return (
    <main className="wrap" style={{ maxWidth: 480, paddingTop: 40 }}>
      <div style={{ background: 'var(--blue)', color: '#fff', borderRadius: 14, padding: '14px 16px' }}>
        <div style={{ fontWeight: 700, letterSpacing: '.08em', fontSize: 13 }}>HOOSE</div>
        <div style={{ fontWeight: 700, fontSize: 18, marginTop: 4 }}>บัญชี HOOSE</div>
      </div>
      <section className="card" style={{ gap: 10 }}>
        {state === 'working' && <span className="mut">กำลังเชื่อมบัญชีกับ LINE…</span>}
        {state === 'done' && <>
          <b style={{ fontSize: 16 }}>บัญชีของคุณพร้อมแล้ว 🎉</b>
          <span className="mut">เชื่อม LINE กับบัญชี {email || 'HOOSE'} แล้ว ใช้ดูแดชบอร์ดงานและอัปเดตโดยรวมได้เลยค่ะ</span>
          <a className="btn" href="/">เข้าแอป HOOSE</a>
        </>}
        {state === 'error' && <><b>ยังเชื่อมบัญชีไม่ได้</b><span className="mut">{msg}</span>
          <button className="btn" onClick={async () => { await sb().auth.signOut(); window.location.reload(); }}>เข้าสู่ระบบด้วยบัญชีอื่น</button></>}
      </section>
    </main>
  );
}
