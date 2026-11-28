'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { NOTIFY, ROLE_TH, STATUS_TH, STATUS_CHIP, fmt } from '@/lib/admin-ui';
import { toast } from '@/lib/ui';

type U = { line_user_id: string; display_name: string; full_name: string; phone: string; email: string; role: string | null; status: string; position: string; portfolio_url: string; following: boolean; last_seen_at: string; applied_at: string | null; created_at: string; status_changed_at: string | null; needs_attention: boolean; attention_note: string; survey: Record<string, string | string[]>; survey_done_at: string | null; picture_url: string };
const FUNNEL = ['new', 'applying', 'applied', 'interview', 'approved', 'active'];

export default function LineAdmin() {
  const [users, setUsers] = useState<U[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [mode, setMode] = useState<'overview' | 'review' | 'team' | 'all'>('review');
  const [role, setRole] = useState('all'); const [status, setStatus] = useState('all'); const [q, setQ] = useState('');
  const load = () => fetch('/api/admin/line').then(async r => {
    if (r.status === 403 || r.status === 401) { setDenied(true); return; }
    setUsers((await r.json()).users || []);
  });
  useEffect(() => {
    load();
    const f = new URLSearchParams(window.location.search).get('f');
    if (f === 'attention') { setMode('all'); setStatus('attention'); }
  }, []);
  const byRole = useMemo(() => (users || []).filter(u => role === 'all' || (role === 'none' ? !u.role : u.role === role)), [users, role]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return byRole.filter(u => (status === 'all' || u.status === status || (status === 'attention' && u.needs_attention)) &&
      (!s || [u.full_name, u.display_name, u.phone, u.email, u.position].some(x => (x || '').toLowerCase().includes(s))));
  }, [byRole, status, q]);
  const count = (st: string) => byRole.filter(u => u.status === st).length;

  return (
    <AdminShell title="รับสมัคร · LINE OA" denied={denied} sub={<span className="mut" style={{ fontSize: 13 }}>{users ? `${users.length} คนใน LINE OA` : ''}</span>}>
      <div className="seg" role="tablist" style={{ alignSelf: 'flex-start' }}>
        <button className={mode === 'review' ? 'on' : ''} onClick={() => setMode('review')}>Pipeline ({(users || []).filter(u => ['applied', 'interview', 'onboarding', 'approved'].includes(u.status)).length})</button>
        <button className={mode === 'overview' ? 'on' : ''} onClick={() => setMode('overview')}>สรุปรับสมัคร</button>
        <button className={mode === 'team' ? 'on' : ''} onClick={() => setMode('team')}>ทีมงาน</button>
        <button className={mode === 'all' ? 'on' : ''} onClick={() => setMode('all')}>ทั้งหมด</button>
      </div>
      {mode === 'overview' ? <Overview users={users} go={(m, st) => { setMode(m); if (st) setStatus(st); }} />
      : mode === 'team' ? <Team users={users} />
      : mode === 'review' ? <Review users={users} reload={load} /> : <>
      <div className="seg" role="group" aria-label="บทบาท" style={{ alignSelf: 'flex-start' }}>
        {[['all', 'ทั้งหมด'], ['editor', 'นักตัดต่อ'], ['crew', 'ทีมโปรดักชัน'], ['manager', 'PM / Producer'], ['none', 'ยังไม่เลือก']].map(([k, l]) =>
          <button key={k} className={role === k ? 'on' : ''} onClick={() => setRole(k)}>{l}</button>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
        {FUNNEL.map(st => (
          <button key={st} className="card" onClick={() => setStatus(status === st ? 'all' : st)}
            style={{ padding: 14, gap: 4, cursor: 'pointer', textAlign: 'left', borderColor: status === st ? 'var(--blue)' : undefined }}>
            <span className="mut" style={{ fontSize: 12 }}>{STATUS_TH[st]}</span>
            <b style={{ fontSize: 24, color: status === st ? 'var(--blue)' : 'var(--ink)' }}>{users ? count(st) : '–'}</b>
          </button>
        ))}
      </div>
      <div className="row w" style={{ gap: 8 }}>
        <input className="in-t" style={{ maxWidth: 320 }} placeholder="ค้นหา ชื่อ เบอร์ อีเมล ตำแหน่ง" value={q} onChange={e => setQ(e.target.value)} />
        <button className={'btn sm' + (status === 'attention' ? ' p' : '')} onClick={() => setStatus(status === 'attention' ? 'all' : 'attention')}>รอทีมตอบ ({byRole.filter(u => u.needs_attention).length})</button>
        <select className="in-t" style={{ maxWidth: 180 }} value={status} onChange={e => setStatus(e.target.value)} aria-label="สถานะ">
          <option value="all">ทุกสถานะ</option>
          {Object.keys(STATUS_TH).map(s => <option key={s} value={s}>{STATUS_TH[s]}</option>)}
        </select>
      </div>
      <section className="card" style={{ padding: 0 }}>
        {!users ? <div className="empty" style={{ margin: 16 }}>กำลังโหลด…</div> : rows.length === 0 ? <div className="empty" style={{ margin: 16 }}>ไม่มีรายชื่อตามตัวกรองนี้</div> : (
          <div className="tblw"><table className="tbl">
            <thead><tr><th>ชื่อ</th><th>บทบาท</th><th>ตำแหน่ง</th><th>สถานะ</th><th>ติดต่อ</th><th>ล่าสุด</th></tr></thead>
            <tbody>{rows.map(u => (
              <tr key={u.line_user_id}>
                <td><Link href={`/admin/line/${u.line_user_id}`} style={{ fontWeight: 600, color: 'var(--blue)' }}>{u.full_name || u.display_name || 'ไม่ทราบชื่อ'}</Link>
                  {u.full_name && u.display_name && u.full_name !== u.display_name && <div className="mut" style={{ fontSize: 12 }}>LINE: {u.display_name}</div>}
                  {!u.following && <div className="mut" style={{ fontSize: 12 }}>เลิกติดตามแล้ว</div>}
                  {u.needs_attention && <div style={{ fontSize: 12, color: 'var(--blue)', fontWeight: 600 }} className="ell">● รอทีมตอบ: {u.attention_note}</div>}</td>
                <td>{u.role ? ROLE_TH[u.role] : <span className="mut">–</span>}</td>
                <td>{u.position || <span className="mut">–</span>}</td>
                <td><span className={STATUS_CHIP[u.status] || 'chip'}>{STATUS_TH[u.status] || u.status}</span></td>
                <td style={{ fontSize: 12 }}>{u.phone || ''}{u.phone && u.email ? <br /> : null}{u.email || ''}{!u.phone && !u.email && <span className="mut">–</span>}</td>
                <td className="mut" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmt(u.last_seen_at)}</td>
              </tr>))}</tbody>
          </table></div>
        )}
      </section>
      </>}
    </AdminShell>
  );
}

/** Recruiting pipeline: portfolio → meeting → documents + form → HOOSE account → team. One tap moves a person and sends the LINE card. */
const STAGES = [
  { key: 'applied',    title: 'ตรวจผลงาน',        hint: 'ดูผลงานแล้วกดผ่าน' },
  { key: 'interview',  title: 'นัดคุย',            hint: 'ส่งลิงก์ Calendly แล้ว' },
  { key: 'onboarding', title: 'เอกสาร + ฟอร์ม',    hint: 'รอพิมพ์ “เสร็จสิ้น”' },
  { key: 'approved',   title: 'สร้างบัญชี HOOSE',  hint: 'ส่งลิงก์สร้างบัญชีแล้ว' },
  { key: 'active',     title: 'ทีมงาน',            hint: 'เชื่อมบัญชีแล้ว' }
] as const;

function Review({ users, reload }: { users: U[] | null; reload: () => void }) {
  const [busy, setBusy] = useState('');
  async function move(u: U, status: string, label: string) {
    const name = u.full_name || u.display_name || 'ผู้สมัคร';
    setBusy(u.line_user_id);
    const r = await fetch(`/api/admin/line/${u.line_user_id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notify: NOTIFY[status](name, u.role) }) });
    const j = await r.json().catch(() => ({})); setBusy('');
    toast(!r.ok ? (j.error || 'ไม่สำเร็จ') : j.sendError ? 'ย้ายแล้ว แต่ส่ง LINE ไม่สำเร็จ' : `${label} · ส่งการ์ดให้ ${name} ใน LINE แล้ว`);
    reload();
  }
  if (!users) return <div className="empty">กำลังโหลด…</div>;
  const since = (u: U) => { const t = u.status === 'applied' ? u.applied_at : u.status_changed_at; return t ? fmt(t) : ''; };
  const actions = (u: U) => {
    const b = !!busy;
    switch (u.status) {
      case 'applied': return <><button className="btn p sm" disabled={b} onClick={() => move(u, 'interview', 'ผ่าน → นัดคุย')}>✓ ผ่าน · นัดคุย</button><button className="btn sm ghost" disabled={b} onClick={() => confirm('ปฏิเสธและแจ้งทาง LINE?') && move(u, 'rejected', 'ปฏิเสธ')}>ปฏิเสธ</button></>;
      case 'interview': return <><button className="btn p sm" disabled={b} onClick={() => move(u, 'onboarding', 'ส่งเอกสาร + ฟอร์ม')}>คุยเสร็จ · ส่งเอกสาร</button><button className="btn sm ghost" disabled={b} onClick={() => confirm('ไม่ผ่านและแจ้งทาง LINE?') && move(u, 'rejected', 'ไม่ผ่าน')}>ไม่ผ่าน</button></>;
      case 'onboarding': return <button className="btn sm ghost" disabled={b} onClick={() => move(u, 'onboarding', 'ส่งเอกสารซ้ำ')}>ส่งเอกสารซ้ำ</button>;
      case 'approved': return <button className="btn sm ghost" disabled={b} onClick={() => move(u, 'approved', 'ส่งลิงก์ซ้ำ')}>ส่งลิงก์สร้างบัญชีซ้ำ</button>;
      default: return null;
    }
  };
  return <>
    <Docs />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(220px, 1fr))', gap: 12, overflowX: 'auto', paddingBottom: 6 }}>
      {STAGES.map(st => {
        const list = users.filter(u => u.status === st.key && (u.role === 'editor' || u.role === 'crew'))
          .sort((a, b) => (a.status_changed_at || a.applied_at || '').localeCompare(b.status_changed_at || b.applied_at || ''));
        return (
          <section key={st.key} style={{ background: 'var(--soft)', borderRadius: 14, padding: 10, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 160 }}>
            <div style={{ padding: '2px 4px' }}>
              <div className="between"><b style={{ fontSize: 14 }}>{st.title}</b><span className="chip">{list.length}</span></div>
              <span className="mut" style={{ fontSize: 11 }}>{st.hint}</span>
            </div>
            {list.length === 0 ? <span className="mut" style={{ fontSize: 12, padding: '6px 4px' }}>ว่าง</span> : list.map(u => {
              const name = u.full_name || u.display_name || 'ไม่ทราบชื่อ';
              return (
                <article key={u.line_user_id} className="card" style={{ padding: 12, gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
                    {u.picture_url ? <img src={u.picture_url} alt="" className="av" style={{ objectFit: 'cover', width: 28, height: 28 }} /> : <span className="av" style={{ width: 28, height: 28 }}>{name[0]}</span>}
                    <div style={{ minWidth: 0 }}>
                      <Link href={`/admin/line/${u.line_user_id}`} className="ell" style={{ fontWeight: 700, color: 'var(--ink)', display: 'block', fontSize: 14 }}>{name}</Link>
                      <span className="mut" style={{ fontSize: 11 }}>{u.role ? ROLE_TH[u.role] : ''}{u.position ? ' · ' + u.position : ''}</span>
                    </div>
                  </div>
                  {u.portfolio_url && st.key === 'applied' && <a href={u.portfolio_url} target="_blank" rel="noreferrer" className="ell" style={{ color: 'var(--blue)', fontWeight: 600, fontSize: 12 }}>▶ ดูผลงาน</a>}
                  <span className="mut" style={{ fontSize: 11 }}>เข้าขั้นนี้ {since(u)}</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{actions(u)}</div>
                </article>);
            })}
          </section>);
      })}
    </div>
  </>;
}

/** PDFs sent with the "คุยเสร็จ · ส่งเอกสาร" step. */
function Docs() {
  const [docs, setDocs] = useState<{ id: string; name: string; audience: string; active: boolean }[] | null>(null);
  const [aud, setAud] = useState('all'); const [busy, setBusy] = useState(false);
  const load = () => fetch('/api/admin/docs').then(r => r.json()).then(j => setDocs(j.docs || []));
  useEffect(() => { load(); }, []);
  async function upload(f: File | undefined) {
    if (!f) return; setBusy(true);
    const fd = new FormData(); fd.append('file', f); fd.append('audience', aud);
    const r = await fetch('/api/admin/docs', { method: 'POST', body: fd }); const j = await r.json().catch(() => ({})); setBusy(false);
    toast(r.ok ? 'อัปโหลดแล้ว' : (j.error || 'อัปโหลดไม่สำเร็จ')); load();
  }
  const patch = async (body: Record<string, unknown>) => { await fetch('/api/admin/docs', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); load(); };
  const AUD: Record<string, string> = { all: 'ทุกคน', editor: 'นักตัดต่อ', crew: 'ทีมโปรดักชัน' };
  return (
    <section className="card" style={{ gap: 10, padding: '14px 16px' }}>
      <div className="between" style={{ gap: 10, flexWrap: 'wrap' }}>
        <div><b style={{ fontSize: 14 }}>เอกสารที่ส่งตอน “คุยเสร็จ · ส่งเอกสาร”</b><div className="mut" style={{ fontSize: 12 }}>PDF (ไม่เกิน 4 MB) ส่งเป็นปุ่มเปิดไฟล์ในการ์ด LINE พร้อมแบบฟอร์มข้อมูล · ลิงก์ใช้ได้ 60 วัน</div></div>
        <div className="row" style={{ gap: 6 }}>
          <select className="in-t" style={{ width: 140 }} value={aud} onChange={e => setAud(e.target.value)} aria-label="ส่งให้ใคร">{Object.entries(AUD).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <label className="btn sm p" style={{ cursor: 'pointer' }}>{busy ? 'กำลังอัปโหลด…' : '+ อัปโหลด PDF'}<input type="file" accept="application/pdf" hidden onChange={e => upload(e.target.files?.[0])} /></label>
        </div>
      </div>
      {docs && docs.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {docs.map(d => (
          <div key={d.id} className="between" style={{ gap: 8, fontSize: 13 }}>
            <span className="ell" style={{ opacity: d.active ? 1 : .5 }}>📄 {d.name} <span className="mut">· {AUD[d.audience]}</span></span>
            <span className="row" style={{ gap: 6 }}>
              <button className="btn sm ghost" onClick={() => patch({ id: d.id, active: !d.active })}>{d.active ? 'ปิดใช้' : 'เปิดใช้'}</button>
              <button className="btn sm ghost" onClick={() => confirm('ลบเอกสารนี้?') && patch({ id: d.id, remove: true })}>ลบ</button>
            </span>
          </div>))}
      </div>}
      {docs && !docs.length && <span className="mut" style={{ fontSize: 12 }}>ยังไม่มีเอกสาร · ถ้าไม่อัปโหลด การ์ดจะส่งเฉพาะแบบฟอร์มข้อมูล</span>}
    </section>
  );
}

const DAY = 86400000;
const since = (iso: string | null | undefined, days: number) => !!iso && Date.now() - new Date(iso).getTime() < days * DAY;

/** Overview: what needs doing now, this week's numbers, and an 8-week trend. */
function Overview({ users, go }: { users: U[] | null; go: (m: 'review' | 'all' | 'team', status?: string) => void }) {
  if (!users) return <div className="empty">กำลังโหลด…</div>;
  const applicants = users.filter(u => u.role === 'editor' || u.role === 'crew');
  const waiting = applicants.filter(u => u.status === 'applied');
  const oldest = waiting.reduce<string | null>((m, u) => !u.applied_at ? m : !m || u.applied_at < m ? u.applied_at : m, null);
  const attention = users.filter(u => u.needs_attention);
  const decided = applicants.filter(u => ['approved', 'active', 'rejected', 'interview'].includes(u.status));
  const passed = applicants.filter(u => ['approved', 'active', 'interview'].includes(u.status));
  const stuck = applicants.filter(u => u.status === 'applying' && !since(u.last_seen_at, 3));
  const byRole = (r: string) => {
    const a = applicants.filter(u => u.role === r);
    return { total: a.length, waiting: a.filter(u => u.status === 'applied').length, team: a.filter(u => ['approved', 'active'].includes(u.status)).length };
  };
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const end = Date.now() - i * 7 * DAY, start = end - 7 * DAY;
    const inWeek = (iso: string | null) => !!iso && +new Date(iso) >= start && +new Date(iso) < end;
    return { label: i === 0 ? 'สัปดาห์นี้' : `${i} สัปดาห์ก่อน`, follows: users.filter(u => inWeek(u.created_at)).length, applied: applicants.filter(u => inWeek(u.applied_at)).length };
  }).reverse();
  const max = Math.max(1, ...weeks.map(w => Math.max(w.follows, w.applied)));
  const tile = (label: string, value: string | number, sub: string, onClick?: () => void, hot = false) => (
    <button className="card" onClick={onClick} disabled={!onClick}
      style={{ padding: 14, gap: 4, textAlign: 'left', cursor: onClick ? 'pointer' : 'default', borderColor: hot ? 'var(--blue)' : undefined }}>
      <span className="mut" style={{ fontSize: 12 }}>{label}</span>
      <b style={{ fontSize: 26, color: hot ? 'var(--blue)' : 'var(--ink)' }}>{value}</b>
      <span className="mut" style={{ fontSize: 12 }}>{sub}</span>
    </button>);
  return (
    <>
      <h2 style={{ margin: 0 }}>ต้องทำตอนนี้</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
        {tile('รอตรวจผลงาน', waiting.length, oldest ? `เก่าสุดส่งเมื่อ ${fmt(oldest)}` : 'ไม่มีค้าง', () => go('review'), waiting.length > 0)}
        {tile('รอทีมตอบในแชท', attention.length, 'คำถามที่น้องฮูสส่งต่อ', () => go('all', 'attention'), attention.length > 0)}
        {tile('สมัครค้างกลางทาง', stuck.length, 'เลือกบทบาทแล้วแต่ไม่ส่งผลงาน > 3 วัน', () => go('all', 'applying'))}
      </div>
      <h2 style={{ margin: '8px 0 0' }}>7 วันที่ผ่านมา</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        {tile('เพิ่มเพื่อนใหม่', users.filter(u => since(u.created_at, 7)).length, 'คน')}
        {tile('ส่งผลงาน', applicants.filter(u => since(u.applied_at, 7)).length, 'ใบสมัคร')}
        {tile('ยืนยันแล้ว', applicants.filter(u => ['approved', 'active'].includes(u.status) && since(u.status_changed_at, 7)).length, 'คน')}
        {tile('อัตราผ่าน (ทั้งหมด)', decided.length ? Math.round(passed.length / decided.length * 100) + '%' : '–', `${passed.length} จาก ${decided.length} ที่ตัดสินแล้ว`)}
      </div>
      <section className="card">
        <h2>แยกตามบทบาท</h2>
        <div className="tblw"><table className="tbl">
          <thead><tr><th>บทบาท</th><th>ทั้งหมด</th><th>รอตรวจ</th><th>ทีมงานที่ผ่านแล้ว</th></tr></thead>
          <tbody>{(['editor', 'crew'] as const).map(r => { const x = byRole(r); return (
            <tr key={r}><td>{ROLE_TH[r]}</td><td>{x.total}</td><td>{x.waiting}</td><td><b>{x.team}</b></td></tr>); })}</tbody>
        </table></div>
      </section>
      <section className="card">
        <div className="between"><h2>8 สัปดาห์ล่าสุด</h2>
          <span className="row" style={{ gap: 12, fontSize: 12 }}><span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: 'var(--blue-bg)', marginRight: 4 }} />เพิ่มเพื่อน</span><span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: 'var(--blue)', marginRight: 4 }} />ส่งผลงาน</span></span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 8, alignItems: 'end', height: 140 }}>
          {weeks.map(w => (
            <div key={w.label} title={`${w.label}: เพิ่มเพื่อน ${w.follows} · ส่งผลงาน ${w.applied}`} style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: '100%', justifyContent: 'center' }}>
              <div style={{ width: '40%', height: `${w.follows / max * 100}%`, minHeight: 2, background: 'var(--blue-bg)', borderRadius: '4px 4px 0 0' }} />
              <div style={{ width: '40%', height: `${w.applied / max * 100}%`, minHeight: 2, background: 'var(--blue)', borderRadius: '4px 4px 0 0' }} />
            </div>))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 8 }}>
          {weeks.map((w, i) => <span key={w.label} className="mut" style={{ fontSize: 10, textAlign: 'center' }}>{i === 7 ? 'นี้' : `-${7 - i}`}</span>)}
        </div>
      </section>
    </>
  );
}

/** Team roster: people who passed, searchable by position, with contact and portfolio. */
function Team({ users }: { users: U[] | null }) {
  const [q, setQ] = useState(''); const [role, setRole] = useState('all');
  if (!users) return <div className="empty">กำลังโหลด…</div>;
  const s = q.trim().toLowerCase();
  const team = users.filter(u => ['approved', 'active'].includes(u.status) && (role === 'all' || u.role === role) &&
    (!s || [u.full_name, u.display_name, u.position, u.phone].some(x => (x || '').toLowerCase().includes(s))));
  const positions = Array.from(new Set(users.filter(u => ['approved', 'active'].includes(u.status) && u.position).map(u => u.position))).sort();
  return (
    <>
      <div className="row w" style={{ gap: 8 }}>
        <div className="seg">{[['all', 'ทั้งหมด'], ['editor', 'นักตัดต่อ'], ['crew', 'ทีมโปรดักชัน']].map(([k, l]) => <button key={k} className={role === k ? 'on' : ''} onClick={() => setRole(k)}>{l}</button>)}</div>
        <input className="in-t" style={{ maxWidth: 280 }} placeholder="ค้นหาชื่อ ตำแหน่ง เบอร์" value={q} onChange={e => setQ(e.target.value)} list="team-pos" />
        <datalist id="team-pos">{positions.map(p => <option key={p} value={p} />)}</datalist>
      </div>
      {team.length === 0 ? <div className="empty">ยังไม่มีทีมงานที่ผ่านการคัดเลือก{s ? 'ตามคำค้นนี้' : ''}</div> : (
        <section className="card" style={{ padding: 0 }}><div className="tblw"><table className="tbl">
          <thead><tr><th>ชื่อ</th><th>ตำแหน่ง</th><th>สถานะ</th><th>เบอร์โทร</th><th>ผลงาน</th></tr></thead>
          <tbody>{team.map(u => (
            <tr key={u.line_user_id}>
              <td><Link href={`/admin/line/${u.line_user_id}`} style={{ fontWeight: 600, color: 'var(--blue)' }}>{u.full_name || u.display_name}</Link>
                <div className="mut" style={{ fontSize: 12 }}>{u.role ? ROLE_TH[u.role] : ''}</div></td>
              <td>{u.position || <span className="mut">–</span>}</td>
              <td><span className={STATUS_CHIP[u.status]}>{STATUS_TH[u.status]}</span></td>
              <td>{u.phone ? <a href={`tel:${u.phone}`}>{u.phone}</a> : <span className="mut">–</span>}</td>
              <td>{u.portfolio_url ? <a href={u.portfolio_url} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>เปิด ▶</a> : <span className="mut">–</span>}</td>
            </tr>))}</tbody>
        </table></div></section>
      )}
    </>
  );
}

