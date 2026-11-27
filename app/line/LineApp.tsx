'use client';
import { useEffect, useState } from 'react';
import { EDITOR_ONBOARD_FORM, SURVEY_LABEL } from '@/lib/line-cards';

// HOOSE LIFF app (opens inside LINE). One LIFF app, three views chosen by ?view=:
//   apply    → application form
//   status   → my application status (mini dashboard)
//   projects → my projects and upcoming dates
// LINE identifies the person (ID token); every API checks the token before reading or saving.

type Liff = {
  init(o: { liffId: string }): Promise<void>;
  isLoggedIn(): boolean; login(o?: { redirectUri?: string }): void;
  getIDToken(): string | null; getProfile(): Promise<{ displayName: string }>;
  isInClient(): boolean; closeWindow(): void;
};
declare global { interface Window { liff?: Liff } }
type View = 'apply' | 'status' | 'projects' | 'work';
type Me = {
  display_name: string; picture_url: string; full_name: string; phone: string; email: string; role: string | null; status: string;
  position: string; portfolio_url: string; survey: Record<string, string | string[]>; survey_done_at: string | null; interview_url: string;
  applied_at: string | null; status_changed_at: string | null;
};
type Project = { id: string; name: string; brand: string; type: string; start_date: string | null; end_date: string | null; locations: string[] | null;
  position: string; state: string; upcoming: { type: string; date: string; time: string | null; title: string }[] };

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


const SITE = 'https://app.hooseofficial.site';
const d = (s?: string | null) => s ? new Date(s).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '';
const EVENT_TH: Record<string, string> = { shoot: '🎥 ถ่ายทำ', brief: '📋 บรีฟ', meeting: '💬 ประชุม' };

function steps(role: string | null) {
  return role === 'crew'
    ? [['applied', 'ส่งใบสมัครและผลงาน'], ['review', 'ทีมพิจารณา 1-3 วันทำการ'], ['approved', 'ผ่านแล้ว · สมัครบัญชีแอป HOOSE'], ['active', 'รับงาน Open Call']]
    : [['applied', 'ส่งใบสมัครและผลงาน'], ['survey', 'แบบสอบถาม 4 ข้อ'], ['review', 'รอผล 1-3 วันทำการ'], ['interview', 'สัมภาษณ์'], ['approved', 'ผ่าน · กรอกข้อมูลทีมงาน'], ['active', 'เริ่มรับงาน']];
}
/** How many steps are done for this person. */
function doneCount(m: Me) {
  const crew = m.role === 'crew';
  const order = ['new', 'applying', 'applied', 'interview', 'approved', 'active'];
  const i = order.indexOf(m.status);
  if (i < 2) return 0;
  if (crew) return m.status === 'applied' ? 1 : m.status === 'interview' ? 2 : m.status === 'approved' ? 3 : 4;
  if (m.status === 'applied') return m.survey_done_at ? 2 : 1;
  return { interview: 3, approved: 5, active: 6 }[m.status] || 3;
}

export default function LineApp({ liffId, view: initial }: { liffId: string; view: View }) {
  const [liff, setLiff] = useState<Liff | null>(null);
  const [view, setView] = useState<View>(initial);
  const [state, setState] = useState<'loading' | 'form' | 'sending' | 'done' | 'error' | 'ready'>('loading');
  const [err, setErr] = useState('');
  const [me, setMe] = useState<Me | null>(null); const [projects, setProjects] = useState<Project[]>([]);
  const [f, setF] = useState({ role: 'editor', full_name: '', phone: '', email: '', position: '', portfolio_url: '', consent: false });
  const set = (k: keyof typeof f, v: string | boolean) => setF(p => ({ ...p, [k]: v }));

  async function loadMe(l: Liff) {
    const r = await fetch('/api/line/me', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: l.getIDToken() }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error || 'โหลดข้อมูลไม่สำเร็จ'); setState('error'); return; }
    setMe(j.user); setProjects(j.projects || []); setState('ready');
  }

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const v = q.get('view'); if (v === 'apply' || v === 'status' || v === 'projects' || v === 'work') setView(v);
    const role = q.get('role'); if (role === 'editor' || role === 'crew') set('role', role);
    if (!liffId) { setErr('ระบบยังไม่ได้ตั้งค่า LIFF ID'); setState('error'); return; }
    loadSdk().then(async l => {
      await l.init({ liffId });
      if (!l.isLoggedIn()) { l.login({ redirectUri: window.location.href }); return; }
      setLiff(l);
      const vv = (q.get('view') as View) || initial;
      if (vv === 'work') { setState('ready'); return; }
      if (vv === 'apply') {
        try { const p = await l.getProfile(); setF(x => ({ ...x, full_name: x.full_name || p.displayName })); } catch { /* name stays empty */ }
        setState('form');
      } else await loadMe(l);
    }).catch(() => { setErr('เปิดหน้านี้ไม่สำเร็จ ปิดแล้วเปิดใหม่จากแชท LINE'); setState('error'); });
  }, [liffId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  function go(v: View) {
    setView(v);
    if (v !== 'apply' && !me && liff) { setState('loading'); loadMe(liff); }
  }

  const positions = f.role === 'editor' ? EDITOR_POS : CREW_POS;
  const back = liff?.isInClient() ? <button className="btn" onClick={() => liff.closeWindow()}>กลับไปที่แชท</button> : null;
  return (
    <main className="wrap" style={{ maxWidth: 520, paddingTop: 16, paddingBottom: 40 }}>
      <div style={{ background: 'var(--blue)', color: '#fff', borderRadius: 14, padding: '14px 16px' }}>
        <div style={{ fontWeight: 700, letterSpacing: '.08em', fontSize: 13 }}>HOOSE</div>
        <div style={{ fontWeight: 700, fontSize: 18, marginTop: 4 }}>
          {view === 'apply' ? `ใบสมัคร${f.role === 'editor' ? 'นักตัดต่อ' : 'ทีมโปรดักชัน'} 📝` : view === 'status' ? 'สถานะของฉัน 📋' : view === 'work' ? 'งานตัดของฉัน ✂️' : 'โปรเจกต์ของฉัน 🎬'}
        </div>
      </div>
      {view !== 'apply' && view !== 'work' && (
        <div className="seg" role="tablist" style={{ alignSelf: 'flex-start' }}>
          <button className={view === 'status' ? 'on' : ''} onClick={() => go('status')}>สถานะ</button>
          <button className={view === 'projects' ? 'on' : ''} onClick={() => go('projects')}>โปรเจกต์</button>
        </div>
      )}

      {state === 'loading' && <div className="card"><span className="mut">กำลังโหลด…</span></div>}
      {state === 'error' && <div className="card"><b>เปิดไม่ได้</b><span className="mut">{err}</span></div>}

      {view === 'apply' && state === 'done' && (
        <div className="card" style={{ gap: 10 }}>
          <b style={{ fontSize: 16 }}>ส่งใบสมัครแล้ว 🎉</b>
          <span className="mut">{f.role === 'editor' ? 'กลับไปที่แชทเพื่อตอบแบบสอบถาม 4 ข้อ (แค่กดเลือก) ได้เลยค่ะ' : 'ทีม HOOSE จะแจ้งผลในแชท LINE ภายใน 1-3 วันทำการค่ะ'}</span>
          {back}
        </div>
      )}
      {view === 'apply' && (state === 'form' || state === 'sending') && (
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

      {view === 'status' && state === 'ready' && (me ? <Status me={me} back={back} /> : <NotYet back={back} />)}
      {view === 'projects' && state === 'ready' && <Projects list={projects} me={me} />}
      {view === 'work' && state === 'ready' && liff && <Work liff={liff} back={back} />}
    </main>
  );
}

function NotYet({ back }: { back: React.ReactNode }) {
  return <div className="card"><b>ยังไม่มีข้อมูลของคุณ</b><span className="mut">พิมพ์ "เมนู" ในแชทเพื่อเลือกบทบาทและเริ่มสมัครได้เลยค่ะ 😊</span>{back}</div>;
}

function Status({ me, back }: { me: Me; back: React.ReactNode }) {
  const list = steps(me.role); const done = doneCount(me);
  const ended = me.status === 'rejected' || me.status === 'blocked';
  const name = me.full_name || me.display_name;
  const surveyRows = Object.entries(SURVEY_LABEL).map(([k, labels]) => {
    const v = me.survey?.[k]; const txt = Array.isArray(v) ? v.map(x => labels[x] || x).join(', ') : v ? labels[v as string] || v : '';
    return [k, txt] as const;
  }).filter(([, t]) => t);
  const Q: Record<string, string> = { style: 'สไตล์ที่ถนัด', per_week: 'ต่อสัปดาห์', work: 'รูปแบบงาน', apps: 'โปรแกรม' };
  return (
    <>
      <section className="card" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {me.picture_url ? <img src={me.picture_url} alt="" className="av lg" style={{ objectFit: 'cover' }} /> : <span className="av lg">{(name || '?')[0]}</span>}
        <div style={{ minWidth: 0 }}>
          <b className="ell" style={{ display: 'block' }}>{name || 'ไม่ทราบชื่อ'}</b>
          <span className="mut" style={{ fontSize: 13 }}>{me.role === 'editor' ? 'นักตัดต่อ' : me.role === 'crew' ? 'ทีมโปรดักชัน' : me.role === 'manager' ? 'PM / Producer' : 'ยังไม่เลือกบทบาท'}{me.position ? ' · ' + me.position : ''}</span>
        </div>
      </section>

      {(me.role === 'editor' || me.role === 'crew') && (
        <section className="card">
          <h2>ขั้นตอนการสมัคร</h2>
          {ended ? <span className="mut">{me.status === 'rejected' ? 'รอบนี้ยังไม่ผ่าน ขอบคุณที่สนใจ HOOSE นะคะ 🙏 ทีมเก็บข้อมูลไว้แล้ว' : 'บัญชีถูกระงับ'}</span> : (
            <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {list.map(([k, label], i) => {
                const isDone = i < done; const isNow = i === done;
                return (
                  <li key={k} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ width: 24, height: 24, borderRadius: 999, flex: '0 0 24px', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700,
                      background: isDone ? 'var(--blue)' : isNow ? 'var(--blue-bg)' : 'var(--soft)', color: isDone ? '#fff' : isNow ? 'var(--blue)' : 'var(--mut)' }}>{isDone ? '✓' : i + 1}</span>
                    <span style={{ fontWeight: isNow ? 700 : 500, color: isDone || isNow ? 'var(--ink)' : 'var(--mut)' }}>{label}{isNow ? ' ← ตอนนี้' : ''}</span>
                  </li>);
              })}
            </ol>
          )}
          {me.status === 'applied' && me.role === 'editor' && !me.survey_done_at && <div className="notice"><span>พิมพ์ “แบบสอบถาม” ในแชทเพื่อตอบ 4 ข้อ (แค่กดเลือก) ✍️</span></div>}
          {me.status === 'interview' && me.interview_url && <a className="btn p" href={me.interview_url} target="_blank" rel="noreferrer">🗓️ นัดเวลาสัมภาษณ์</a>}
          {me.status === 'approved' && me.role === 'editor' && <a className="btn p" href={EDITOR_ONBOARD_FORM} target="_blank" rel="noreferrer">📝 กรอกข้อมูลทีมงาน</a>}
          {me.status === 'approved' && me.role === 'crew' && <a className="btn p" href={SITE + '/login?mode=signup'} target="_blank" rel="noreferrer">สมัครบัญชีในแอป HOOSE</a>}
        </section>
      )}

      <section className="card">
        <h2>ข้อมูลที่ส่งไว้</h2>
        <Row k="เบอร์โทร" v={me.phone} /><Row k="อีเมล" v={me.email} />
        <Row k="ลิงก์ผลงาน" v={me.portfolio_url} href={me.portfolio_url} />
        {surveyRows.map(([k, t]) => <Row key={k} k={Q[k]} v={t} />)}
        <Row k="ส่งใบสมัคร" v={d(me.applied_at)} />
        <span className="mut" style={{ fontSize: 12 }}>ต้องการแก้ข้อมูล พิมพ์บอกน้องฮูสในแชทได้เลยค่ะ</span>
      </section>
      {back}
    </>
  );
}

function Row({ k, v, href }: { k: string; v?: string; href?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
      <span className="mut">{k}</span>
      {v ? (href ? <a href={href} target="_blank" rel="noreferrer" className="ell" style={{ color: 'var(--blue)', maxWidth: '60%' }}>{v}</a> : <span className="ell" style={{ maxWidth: '60%', textAlign: 'right' }}>{v}</span>) : <span className="mut">–</span>}
    </div>);
}

function Projects({ list, me }: { list: Project[]; me: Me | null }) {
  if (!list.length) return (
    <div className="card"><b>ยังไม่มีโปรเจกต์ 🎬</b>
      <span className="mut">{me && ['approved', 'active'].includes(me.status) ? 'เมื่อรับงาน Open Call แล้ว โปรเจกต์และวันถ่ายจะขึ้นที่นี่ค่ะ' : 'เมื่อผ่านการคัดเลือกและรับงานแล้ว โปรเจกต์จะขึ้นที่นี่ค่ะ'}</span></div>);
  return <>{list.map(p => (
    <section key={p.id} className="card" style={{ gap: 8 }}>
      <div className="between" style={{ gap: 8 }}><b className="ell">{p.name}</b><span className={p.state === 'ยืนยันแล้ว' ? 'chip b' : 'chip lb'}>{p.state}</span></div>
      <span className="mut" style={{ fontSize: 13 }}>{[p.brand, p.type, p.position && 'ตำแหน่ง ' + p.position].filter(Boolean).join(' · ')}</span>
      <span style={{ fontSize: 13 }}>📅 {p.start_date ? d(p.start_date) + (p.end_date && p.end_date !== p.start_date ? ' – ' + d(p.end_date) : '') : 'ยังไม่กำหนดวัน'}{p.locations?.length ? ' · 📍 ' + p.locations.join(', ') : ''}</span>
      {p.upcoming.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
          {p.upcoming.map((e, i) => <span key={i} style={{ fontSize: 13 }}>{EVENT_TH[e.type] || e.type} {d(e.date)}{e.time ? ' ' + e.time.slice(0, 5) : ''} · {e.title}</span>)}
        </div>)}
    </section>))}</>;
}

type WTask = { id: string; name: string; parent_name: string; url: string; status: string; stage: string; due_date: number | null; date_done: number | null };
type WorkData = { linked: boolean; reason?: string; stats?: { active: number; todo: number; review: number; overdue: number; dueSoon: number; done30: number; onTime: number | null }; open?: WTask[]; done?: WTask[] };

/** Editor landing: current ClickUp jobs, due dates and a small performance summary. */
function Work({ liff, back }: { liff: Liff; back: React.ReactNode }) {
  const [w, setW] = useState<WorkData | null>(null); const [err, setErr] = useState('');
  useEffect(() => {
    fetch('/api/line/work', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: liff.getIDToken() }) })
      .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) setErr(j.error || 'โหลดไม่สำเร็จ'); else setW(j); });
  }, [liff]);
  if (err) return <div className="card"><b>เปิดไม่ได้</b><span className="mut">{err}</span></div>;
  if (!w) return <div className="card"><span className="mut">กำลังโหลดงาน…</span></div>;
  if (!w.linked) return (
    <div className="card" style={{ gap: 8 }}>
      <b>{w.reason === 'not_member' ? 'หน้านี้สำหรับทีมตัดต่อ HOOSE ✂️' : 'ยังไม่เห็นงานใน ClickUp ของคุณ'}</b>
      <span className="mut">{w.reason === 'not_member' ? 'เมื่อผ่านการคัดเลือกแล้ว งานและกำหนดส่งจะขึ้นที่นี่ค่ะ' : 'ทีมงานกำลังผูกบัญชี ClickUp ให้ ถ้ารอนานพิมพ์บอกน้องฮูสในแชทได้เลยค่ะ'}</span>{back}
    </div>);
  const s = w.stats!;
  const due = (t: WTask) => {
    if (!t.due_date) return 'ยังไม่กำหนดส่ง';
    const days = Math.ceil((t.due_date - Date.now()) / 864e5);
    const dd = new Date(t.due_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    return days < 0 ? `เลยกำหนด ${-days} วัน (${dd})` : days === 0 ? `ส่งวันนี้ (${dd})` : `อีก ${days} วัน (${dd})`;
  };
  const STAGE: Record<string, string> = { todo: 'ยังไม่เริ่ม', doing: 'กำลังตัด', review: 'รอตรวจ / แก้', done: 'เสร็จแล้ว' };
  const tile = (label: string, v: string | number, hot = false) => (
    <div className="card" style={{ padding: 12, gap: 2 }}><span className="mut" style={{ fontSize: 11 }}>{label}</span><b style={{ fontSize: 22, color: hot ? 'var(--blue)' : 'var(--ink)' }}>{v}</b></div>);
  return <>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {tile('งานที่ถืออยู่', s.active, s.active > 0)}{tile('เลยกำหนด', s.overdue, s.overdue > 0)}{tile('ใกล้ส่ง (3 วัน)', s.dueSoon)}
      {tile('เสร็จ 30 วัน', s.done30)}{tile('ส่งตรงเวลา', s.onTime === null ? '–' : s.onTime + '%')}{tile('รอตรวจ / แก้', s.review)}
    </div>
    <section className="card" style={{ gap: 10 }}>
      <h2>งานปัจจุบัน</h2>
      {!w.open!.length ? <span className="mut">ตอนนี้ไม่มีงานค้าง 🙌 มีงานใหม่น้องฮูสจะส่งให้ในแชทค่ะ</span> : w.open!.map(t => (
        <a key={t.id} href={t.url} target="_blank" rel="noreferrer" style={{ display: 'flex', flexDirection: 'column', gap: 2, borderBottom: '1px solid var(--line)', paddingBottom: 8, color: 'inherit' }}>
          <div className="between" style={{ gap: 8 }}><b className="ell">{t.name}</b><span className={t.stage === 'todo' ? 'chip o' : 'chip lb'}>{STAGE[t.stage]}</span></div>
          <span className="mut" style={{ fontSize: 12 }}>{t.parent_name ? t.parent_name + ' · ' : ''}{due(t)}</span>
        </a>))}
    </section>
    {w.done!.length > 0 && (
      <section className="card" style={{ gap: 6 }}>
        <h2>เสร็จล่าสุด</h2>
        {w.done!.map(t => <span key={t.id} style={{ fontSize: 13 }}>✓ {t.name}{t.parent_name ? <span className="mut"> · {t.parent_name}</span> : null}</span>)}
      </section>)}
    {back}
  </>;
}
