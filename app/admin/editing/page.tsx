'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import AdminShell, { Grid, Tile } from '@/components/admin/AdminShell';
import { toast } from '@/lib/ui';

type U = { id: number; username: string };
type Call = { id: string; status: string; sent_to: number; assigned_line_user_id: string | null; clickup_assigned: boolean; created_at: string };
type T = { id: string; name: string; parent_name: string; url: string; status: string; stage: string; assignees: U[]; due_date: number | null; date_done: number | null; call: Call | null };
type P = { id: number; username: string; email: string; profilePicture: string | null; line: { line_user_id: string } | null;
  stats: { active: number; todo: number; review: number; overdue: number; dueSoon: number; done30: number; onTime: number | null } };
type D = { configured: boolean; unassigned: T[]; inProgress: T[]; doneRecent: T[]; people: P[]; editorsOnLine: number; unlinkedEditors: { line_user_id: string; name: string }[] };

const STAGE: Record<string, string> = { todo: 'ยังไม่เริ่ม', doing: 'กำลังตัด', review: 'รอตรวจ / แก้', done: 'เสร็จ' };
const dueText = (ms: number | null) => {
  if (!ms) return 'ไม่กำหนดส่ง';
  const days = Math.ceil((ms - Date.now()) / 864e5);
  const d = new Date(ms).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  return days < 0 ? `เลย ${-days} วัน (${d})` : days === 0 ? `วันนี้ (${d})` : `อีก ${days} วัน (${d})`;
};

/** Editing: ClickUp work, announce unassigned tasks on LINE (first editor to accept is assigned), team workload. */
export default function Editing() {
  const [d, setD] = useState<D | null>(null); const [denied, setDenied] = useState(false); const [err, setErr] = useState('');
  const [tab, setTab] = useState<'new' | 'doing' | 'team' | 'done'>('new');
  const [compose, setCompose] = useState<T | null>(null); const [detail, setDetail] = useState(''); const [rate, setRate] = useState(''); const [busy, setBusy] = useState(false);
  const load = () => fetch('/api/admin/editing').then(async r => {
    if (r.status === 403 || r.status === 401) { setDenied(true); return; }
    const j = await r.json().catch(() => ({})); if (!r.ok) { setErr(j.error || 'โหลดไม่สำเร็จ'); return; } setD(j);
  }).catch(e => setErr(String(e)));
  useEffect(() => { load(); }, []);

  async function announce() {
    if (!compose) return; setBusy(true);
    const r = await fetch('/api/admin/editing/call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task_id: compose.id, detail, rate }) });
    const j = await r.json().catch(() => ({})); setBusy(false);
    if (!r.ok) { toast(j.error || 'ประกาศไม่สำเร็จ'); return; }
    toast(`ประกาศแล้ว · ส่งถึงนักตัดต่อ ${j.sent} คน`); setCompose(null); setDetail(''); setRate(''); load();
  }
  async function cancel(c: Call) {
    if (!confirm('ยกเลิกประกาศนี้? คนที่กดรับหลังจากนี้จะได้ข้อความว่ามีคนรับแล้ว')) return;
    await fetch('/api/admin/editing/call?id=' + c.id, { method: 'DELETE' }); load();
  }

  const row = (t: T, action?: React.ReactNode) => (
    <div key={t.id} className="between" style={{ gap: 10, borderBottom: '1px solid var(--line)', padding: '10px 0' }}>
      <div style={{ minWidth: 0 }}>
        <a href={t.url} target="_blank" rel="noreferrer" className="ell" style={{ fontWeight: 600, color: 'var(--ink)', display: 'block' }}>{t.name}</a>
        <span className="mut" style={{ fontSize: 12 }}>{[t.parent_name, t.status, dueText(t.due_date), t.assignees.map(a => a.username).join(', ')].filter(Boolean).join(' · ')}</span>
      </div>
      {action}
    </div>);

  return (
    <AdminShell title="ตัดต่อ · ClickUp" denied={denied} sub={d?.configured ? <span className="mut" style={{ fontSize: 13 }}>นักตัดต่อใน LINE OA {d.editorsOnLine} คน</span> : null}>
      {err ? <div className="notice"><span>{err}</span></div>
      : !d ? <div className="empty">กำลังดึงงานจาก ClickUp…</div>
      : !d.configured ? <div className="card"><b>ยังไม่ได้เชื่อม ClickUp</b><span className="mut">ใส่ CLICKUP_API_TOKEN ใน Vercel (ClickUp → Settings → Apps → API Token) แล้ว Redeploy</span></div>
      : <>
        <Grid>
          <Tile label="ยังไม่มีคนรับ" value={d.unassigned.length} hot={d.unassigned.length > 0} onClick={() => setTab('new')} />
          <Tile label="กำลังทำ" value={d.inProgress.length} onClick={() => setTab('doing')} />
          <Tile label="เลยกำหนด" value={d.inProgress.filter(t => t.due_date && t.due_date < Date.now()).length} hot={d.inProgress.some(t => t.due_date && t.due_date < Date.now())} onClick={() => setTab('doing')} />
          <Tile label="เสร็จ 14 วัน" value={d.doneRecent.length} onClick={() => setTab('done')} />
        </Grid>
        {d.unlinkedEditors.length > 0 && <div className="notice"><span>นักตัดต่อ {d.unlinkedEditors.length} คนยังไม่ผูกบัญชี ClickUp (assign อัตโนมัติไม่ได้): {d.unlinkedEditors.map(x => x.name).join(', ')}</span></div>}
        <div className="seg" style={{ alignSelf: 'flex-start' }}>
          {([['new', `งานใหม่ (${d.unassigned.length})`], ['doing', `กำลังทำ (${d.inProgress.length})`], ['team', 'ทีมตัดต่อ'], ['done', 'เสร็จล่าสุด']] as const).map(([k, l]) =>
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
        </div>

        {tab === 'new' && <section className="card" style={{ gap: 0 }}>
          {!d.unassigned.length ? <div className="empty">ทุกงานมีคนรับแล้ว 🎉</div> : d.unassigned.map(t => row(t,
            t.call?.status === 'open'
              ? <span className="row" style={{ gap: 6 }}><span className="chip lb">ประกาศแล้ว รอคนรับ</span><button className="btn sm ghost" onClick={() => cancel(t.call!)}>ยกเลิก</button></span>
              : t.call?.status === 'assigned' ? <span className="chip k">มีคนรับแล้ว{t.call.clickup_assigned ? '' : ' · รอ assign ใน ClickUp'}</span>
              : <button className="btn p sm" onClick={() => { setCompose(t); setDetail(''); setRate(''); }}>ประกาศหานักตัดต่อ?</button>))}
        </section>}

        {compose && (
          <section className="card" style={{ borderColor: 'var(--blue)' }}>
            <h2>ประกาศหานักตัดต่อ · {compose.name}</h2>
            <span className="mut" style={{ fontSize: 13 }}>{compose.parent_name} · ส่งงาน {dueText(compose.due_date)} · ส่งถึงนักตัดต่อที่ผ่านแล้ว {d.editorsOnLine} คน · คนแรกที่กดรับจะถูก assign ใน ClickUp อัตโนมัติ</span>
            <label className="f">รายละเอียดงาน (ความยาว สไตล์ ลิงก์ฟุตเทจ ฯลฯ)<textarea className="in-t" style={{ height: 90, padding: 10 }} value={detail} onChange={e => setDetail(e.target.value)} /></label>
            <label className="f">ค่าตัว (ไม่บังคับ)<input className="in-t" value={rate} onChange={e => setRate(e.target.value)} placeholder="เช่น 800 บาท / คลิป" /></label>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn p sm" disabled={busy} onClick={announce}>{busy ? 'กำลังส่ง…' : 'ยืนยัน ประกาศทาง LINE'}</button>
              <button className="btn sm ghost" onClick={() => setCompose(null)}>ยกเลิก</button>
            </div>
          </section>)}

        {tab === 'doing' && <section className="card" style={{ gap: 0 }}>
          {!d.inProgress.length ? <div className="empty">ไม่มีงานค้าง</div> : d.inProgress.map(t => row(t,
            <span className={t.due_date && t.due_date < Date.now() ? 'chip b' : t.stage === 'todo' ? 'chip o' : 'chip lb'}>{t.due_date && t.due_date < Date.now() ? 'เลยกำหนด' : STAGE[t.stage]}</span>))}
        </section>}

        {tab === 'team' && <section className="card" style={{ padding: 0 }}><div className="tblw"><table className="tbl">
          <thead><tr><th>นักตัดต่อ</th><th>ถืออยู่</th><th>ยังไม่เริ่ม</th><th>เลยกำหนด</th><th>ใกล้ส่ง</th><th>เสร็จ 30 วัน</th><th>ตรงเวลา</th><th>LINE</th></tr></thead>
          <tbody>{d.people.map(p => (
            <tr key={p.id}>
              <td><b>{p.username}</b><div className="mut" style={{ fontSize: 11 }}>{p.email}</div></td>
              <td>{p.stats.active}</td><td>{p.stats.todo}</td>
              <td style={{ color: p.stats.overdue ? 'var(--blue)' : undefined, fontWeight: p.stats.overdue ? 700 : 400 }}>{p.stats.overdue}</td>
              <td>{p.stats.dueSoon}</td><td>{p.stats.done30}</td><td>{p.stats.onTime === null ? '–' : p.stats.onTime + '%'}</td>
              <td>{p.line ? <Link href={`/admin/line/${p.line.line_user_id}`} style={{ color: 'var(--blue)' }}>เปิด</Link> : <span className="mut">ยังไม่เชื่อม</span>}</td>
            </tr>))}</tbody>
        </table></div></section>}

        {tab === 'done' && <section className="card" style={{ gap: 0 }}>
          {!d.doneRecent.length ? <div className="empty">ยังไม่มีงานเสร็จใน 14 วัน</div> : d.doneRecent.map(t => row(t, <span className="chip k">{t.status}</span>))}
        </section>}
      </>}
    </AdminShell>
  );
}
