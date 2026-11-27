'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import TopBar from '@/components/TopBar';
import { NOTIFY, ROLE_TH, STATUS_TH, STATUS_CHIP, fmt } from '@/lib/admin-ui';
import { toast } from '@/lib/ui';

type U = { line_user_id: string; display_name: string; full_name: string; phone: string; email: string; role: string | null; status: string; position: string; portfolio_url: string; following: boolean; last_seen_at: string; applied_at: string | null; needs_attention: boolean; attention_note: string; survey: Record<string, string | string[]>; survey_done_at: string | null; picture_url: string };
const FUNNEL = ['new', 'applying', 'applied', 'interview', 'approved', 'active'];

export default function LineAdmin() {
  const [users, setUsers] = useState<U[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [mode, setMode] = useState<'review' | 'all'>('review');
  const [role, setRole] = useState('all'); const [status, setStatus] = useState('all'); const [q, setQ] = useState('');
  const load = () => fetch('/api/admin/line').then(async r => {
    if (r.status === 403 || r.status === 401) { setDenied(true); return; }
    setUsers((await r.json()).users || []);
  });
  useEffect(() => { load(); }, []);
  const byRole = useMemo(() => (users || []).filter(u => role === 'all' || (role === 'none' ? !u.role : u.role === role)), [users, role]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return byRole.filter(u => (status === 'all' || u.status === status || (status === 'attention' && u.needs_attention)) &&
      (!s || [u.full_name, u.display_name, u.phone, u.email, u.position].some(x => (x || '').toLowerCase().includes(s))));
  }, [byRole, status, q]);
  const count = (st: string) => byRole.filter(u => u.status === st).length;

  if (denied) return <><TopBar label="Admin" /><main className="wrap"><div className="empty">หน้านี้สำหรับแอดมิน HOOSE เท่านั้น</div></main></>;
  return (
    <><TopBar label="Admin · LINE OA" /><main className="wrap">
      <div className="between"><h1>ผู้สมัครจาก LINE OA</h1><span className="mut" style={{ fontSize: 13 }}>{users ? `${users.length} คน` : ''}</span></div>
      <div className="seg" role="tablist" style={{ alignSelf: 'flex-start' }}>
        <button className={mode === 'review' ? 'on' : ''} onClick={() => setMode('review')}>ตรวจผลงาน ({(users || []).filter(u => u.status === 'applied').length})</button>
        <button className={mode === 'all' ? 'on' : ''} onClick={() => setMode('all')}>ผู้สมัครทั้งหมด</button>
      </div>
      {mode === 'review' ? <Review users={users} reload={load} /> : <>
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
    </main></>
  );
}

/** Review queue: applicants waiting for a decision. Only the portfolio and two buttons. */
function Review({ users, reload }: { users: U[] | null; reload: () => void }) {
  const [busy, setBusy] = useState('');
  const queue = (users || []).filter(u => u.status === 'applied').sort((a, b) => (a.applied_at || '').localeCompare(b.applied_at || ''));
  async function decide(u: U, status: 'approved' | 'rejected') {
    const name = u.full_name || u.display_name || 'ผู้สมัคร';
    if (!confirm(`${status === 'approved' ? 'ยืนยัน' : 'ปฏิเสธ'}: ${name}\nจะแจ้งผลทาง LINE ทันที`)) return;
    setBusy(u.line_user_id);
    const r = await fetch(`/api/admin/line/${u.line_user_id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notify: NOTIFY[status](name, u.role) }) });
    const j = await r.json().catch(() => ({})); setBusy('');
    toast(!r.ok ? (j.error || 'ไม่สำเร็จ') : j.sendError ? 'บันทึกแล้ว แต่ส่ง LINE ไม่สำเร็จ' : `${status === 'approved' ? 'ยืนยัน' : 'ปฏิเสธ'} ${name} · แจ้งทาง LINE แล้ว`);
    reload();
  }
  if (!users) return <div className="empty">กำลังโหลด…</div>;
  if (!queue.length) return <div className="empty">ไม่มีผลงานรอตรวจ 🎉</div>;
  return <>{queue.map(u => {
    const name = u.full_name || u.display_name || 'ไม่ทราบชื่อ';
    return (
      <section key={u.line_user_id} className="card" style={{ gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
          {u.picture_url ? <img src={u.picture_url} alt="" className="av" style={{ objectFit: 'cover' }} /> : <span className="av">{name[0]}</span>}
          <div style={{ minWidth: 0 }}>
            <Link href={`/admin/line/${u.line_user_id}`} className="ell" style={{ fontWeight: 700, color: 'var(--ink)', display: 'block' }}>{name}</Link>
            <span className="mut" style={{ fontSize: 12 }}>{u.role ? ROLE_TH[u.role] : '–'}{u.position ? ' · ' + u.position : ''} · ส่ง {fmt(u.applied_at)}</span>
          </div>
        </div>
        {u.portfolio_url
          ? <a href={u.portfolio_url} target="_blank" rel="noreferrer" className="ell" style={{ color: 'var(--blue)', fontWeight: 600 }}>▶ {u.portfolio_url}</a>
          : <span className="mut">ยังไม่มีลิงก์ผลงาน</span>}
        <div className="row" style={{ gap: 8 }}>
          <button className="btn p sm" disabled={!!busy} onClick={() => decide(u, 'approved')}>✓ ยืนยัน</button>
          <button className="btn sm ghost" disabled={!!busy} onClick={() => decide(u, 'rejected')}>ปฏิเสธ</button>
        </div>
      </section>);
  })}</>;
}
