'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import AdminShell, { Grid, Tile } from '@/components/admin/AdminShell';
import { toast } from '@/lib/ui';

type Call = { id: string; status: string; reason: string; sent_to: number; clickup_assigned: boolean; created_at: string };
type Pj = { id: string; name: string; url: string; status: string; due: number | null; description: string; refs: string[]; total: number; open: number; openNames: string[];
  assignees: { id: number; username: string }[]; call: Call | null; state: 'ok' | 'due_soon' | 'overdue' };
type P = { id: number; username: string; email: string; line: { line_user_id: string } | null;
  stats: { active: number; todo: number; review: number; overdue: number; dueSoon: number; done30: number; onTime: number | null } };
type D = { configured: boolean; webhook: boolean; hiddenOld: number; unassigned: Pj[]; inProgress: Pj[]; doneRecent: { id: string; name: string; url: string; total: number; date_done: number }[];
  people: P[]; editorsOnLine: number; unlinkedEditors: { line_user_id: string; name: string }[]; reassigned: number };

const dueText = (ms: number | null) => {
  if (!ms) return 'ไม่กำหนดส่ง';
  const days = Math.ceil((ms - Date.now()) / 864e5);
  const d = new Date(ms).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  return days < 0 ? `เลย ${-days} วัน (${d})` : days === 0 ? `วันนี้ (${d})` : `อีก ${days} วัน (${d})`;
};

/** Editing by project: announce new ClickUp projects on LINE, follow deadlines, team workload. */
export default function Editing() {
  const [d, setD] = useState<D | null>(null); const [denied, setDenied] = useState(false); const [err, setErr] = useState('');
  const [tab, setTab] = useState<'new' | 'doing' | 'team' | 'done'>('new');
  const [compose, setCompose] = useState<Pj | null>(null); const [detail, setDetail] = useState(''); const [rate, setRate] = useState(''); const [busy, setBusy] = useState('');
  const load = () => fetch('/api/admin/editing').then(async r => {
    if (r.status === 403 || r.status === 401) { setDenied(true); return; }
    const j = await r.json().catch(() => ({})); if (!r.ok) { setErr(j.error || 'โหลดไม่สำเร็จ'); return; } setErr(''); setD(j);
  }).catch(e => setErr(String(e)));
  useEffect(() => { load(); }, []);

  async function post(url: string, body: unknown, ok: (j: Record<string, unknown>) => string, key: string) {
    setBusy(key);
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({})); setBusy('');
    toast(r.ok ? ok(j) : (j.error || 'ไม่สำเร็จ')); if (r.ok) load();
    return r.ok;
  }
  const announce = async () => { if (compose && await post('/api/admin/editing/call', { project_id: compose.id, detail, rate }, j => `ประกาศแล้ว · ส่งถึงนักตัดต่อ ${j.sent} คน`, 'call')) setCompose(null); };
  const check = () => {
    if (!confirm('ตรวจทุกโปรเจกต์ตอนนี้?\n• ใกล้ครบกำหนด → แจ้งคนที่รับงาน\n• เลยกำหนด → เอาคนออกจาก ClickUp แล้วประกาศหาใหม่ทันที\n• เสร็จแล้ว → ส่งคำขอบคุณ')) return;
    post('/api/admin/editing/check', {}, j => `ตรวจแล้ว · ใกล้ครบ ${j.dueSoon} · ส่งต่อใหม่ ${j.reassigned} · ขอบคุณ ${j.thanked}${(j.errors as string[])?.length ? ' · มีบางอันไม่สำเร็จ' : ''}`, 'check');
  };
  const connect = () => post('/api/admin/editing/webhook', {}, () => 'เชื่อม ClickUp อัตโนมัติแล้ว', 'hook');
  async function cancel(c: Call) {
    if (!confirm('ยกเลิกประกาศนี้?')) return;
    await fetch('/api/admin/editing/call?id=' + c.id, { method: 'DELETE' }); load();
  }

  const card = (p: Pj, action: React.ReactNode) => (
    <div key={p.id} style={{ borderBottom: '1px solid var(--line)', padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div className="between" style={{ gap: 10 }}>
        <a href={p.url} target="_blank" rel="noreferrer" className="ell" style={{ fontWeight: 700, color: 'var(--ink)' }}>{p.name}</a>
        {action}
      </div>
      <span className="mut" style={{ fontSize: 12 }}>
        {p.total > 1 ? `ยังไม่ส่ง ${p.open}/${p.total} คลิป` : p.status} · <span style={{ color: p.state !== 'ok' ? 'var(--blue)' : undefined, fontWeight: p.state !== 'ok' ? 700 : 400 }}>Deadline {dueText(p.due)}</span>
        {p.assignees.length ? ' · ' + p.assignees.map(a => a.username).join(', ') : ''}{p.refs.length ? ` · REF ${p.refs.length}` : ''}
      </span>
    </div>);

  return (
    <AdminShell title="ตัดต่อ · ClickUp" denied={denied} sub={d?.configured ? <span className="mut" style={{ fontSize: 13 }}>นักตัดต่อใน LINE OA {d.editorsOnLine} คน</span> : null}>
      {err ? <div className="notice"><span>{err}</span></div>
      : !d ? <div className="empty">กำลังดึงโปรเจกต์จาก ClickUp…</div>
      : !d.configured ? <div className="card"><b>ยังไม่ได้เชื่อม ClickUp</b><span className="mut">ใส่ ClickUp API Token ใน Vercel แล้ว Redeploy</span></div>
      : <>
        <section className="card" style={{ gap: 8 }}>
          <div className="between" style={{ gap: 8 }}>
            <div><b>แจ้งเตือนอัตโนมัติเมื่อมีความเปลี่ยนแปลง</b>
              <div className="mut" style={{ fontSize: 12 }}>{d.webhook ? 'เชื่อมแล้ว · ClickUp แจ้งทุกครั้งที่งานเปลี่ยน แล้วระบบตรวจกำหนดส่งให้' : 'ยังไม่เชื่อม · กดเชื่อมเพื่อให้ ClickUp แจ้งระบบเมื่องานเปลี่ยน'}</div></div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn sm" disabled={!!busy} onClick={connect}>{d.webhook ? 'เชื่อมใหม่' : 'เชื่อม ClickUp'}</button>
              <button className="btn p sm" disabled={!!busy} onClick={check}>{busy === 'check' ? 'กำลังตรวจ…' : 'ตรวจตอนนี้'}</button>
            </div>
          </div>
        </section>
        <Grid>
          <Tile label="โปรเจกต์ยังไม่มีคนรับ" value={d.unassigned.length} hot={d.unassigned.length > 0} onClick={() => setTab('new')} />
          <Tile label="กำลังทำ" value={d.inProgress.length} onClick={() => setTab('doing')} />
          <Tile label="ใกล้ครบ / เลยกำหนด" value={d.inProgress.filter(p => p.state !== 'ok').length} hot={d.inProgress.some(p => p.state !== 'ok')} onClick={() => setTab('doing')} />
          <Tile label="ส่งต่อใหม่ 14 วัน" value={d.reassigned} sub="เลยกำหนดแล้วหาคนแทน" />
        </Grid>
        {d.hiddenOld > 0 && <span className="mut" style={{ fontSize: 12 }}>แสดงเฉพาะงานปัจจุบัน · ซ่อนงานเก่า {d.hiddenOld} รายการ (ข้อมูลใน ClickUp ไม่ถูกแตะ)</span>}
        {d.unlinkedEditors.length > 0 && <div className="notice"><span>ยังไม่ผูกบัญชี ClickUp: {d.unlinkedEditors.map(x => x.name).join(', ')}</span></div>}
        <div className="seg" style={{ alignSelf: 'flex-start' }}>
          {([['new', `โปรเจกต์ใหม่ (${d.unassigned.length})`], ['doing', `กำลังทำ (${d.inProgress.length})`], ['team', 'ทีมตัดต่อ'], ['done', 'เสร็จล่าสุด']] as const).map(([k, l]) =>
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
        </div>

        {tab === 'new' && <section className="card" style={{ gap: 0, paddingTop: 4 }}>
          {!d.unassigned.length ? <div className="empty">ทุกโปรเจกต์มีคนรับแล้ว 🎉</div> : d.unassigned.map(p => card(p,
            p.call?.status === 'open'
              ? <span className="row" style={{ gap: 6 }}><span className="chip lb">{p.call.reason === 'reassign' ? 'หาคนแทน' : 'ประกาศแล้ว'} · ส่ง {p.call.sent_to} คน</span><button className="btn sm ghost" onClick={() => cancel(p.call!)}>ยกเลิก</button></span>
              : <button className="btn p sm" onClick={() => { setCompose(p); setDetail(p.description); setRate(''); }}>ประกาศหานักตัดต่อ?</button>))}
        </section>}

        {compose && (
          <section className="card" style={{ borderColor: 'var(--blue)' }}>
            <h2>ประกาศโปรเจกต์ · {compose.name}</h2>
            <span className="mut" style={{ fontSize: 13 }}>{compose.total} คลิป · Deadline {dueText(compose.due)} · ส่งถึงนักตัดต่อ {d.editorsOnLine} คน · คนแรกที่กดรับจะถูก assign ทั้งโปรเจกต์ใน ClickUp</span>
            <label className="f">รายละเอียดงาน (ดึงจาก description ใน ClickUp แก้ได้)<textarea className="in-t" style={{ height: 110, padding: 10 }} value={detail} onChange={e => setDetail(e.target.value)} /></label>
            {compose.refs.length > 0 && <span style={{ fontSize: 13 }}>REF ที่จะแนบ: {compose.refs.slice(0, 2).map(u => <a key={u} href={u} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', marginRight: 8 }}>{u.replace(/^https?:\/\//, '').slice(0, 40)}</a>)}</span>}
            <label className="f">ค่าตัว (ไม่บังคับ)<input className="in-t" value={rate} onChange={e => setRate(e.target.value)} placeholder="เช่น 800 บาท / คลิป" /></label>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn p sm" disabled={!!busy} onClick={announce}>{busy === 'call' ? 'กำลังส่ง…' : 'ยืนยัน ประกาศทาง LINE'}</button>
              <button className="btn sm ghost" onClick={() => setCompose(null)}>ยกเลิก</button>
            </div>
          </section>)}

        {tab === 'doing' && <section className="card" style={{ gap: 0, paddingTop: 4 }}>
          {!d.inProgress.length ? <div className="empty">ไม่มีโปรเจกต์ค้าง</div> : d.inProgress.map(p => card(p,
            <span className={p.state === 'overdue' ? 'chip b' : p.state === 'due_soon' ? 'chip lb' : 'chip o'}>{p.state === 'overdue' ? 'เลยกำหนด' : p.state === 'due_soon' ? 'ใกล้ครบ' : 'กำลังทำ'}</span>))}
        </section>}

        {tab === 'team' && <section className="card" style={{ padding: 0 }}><div className="tblw"><table className="tbl">
          <thead><tr><th>นักตัดต่อ</th><th>คลิปที่ถือ</th><th>ยังไม่เริ่ม</th><th>เลยกำหนด</th><th>ใกล้ส่ง</th><th>เสร็จ 30 วัน</th><th>ตรงเวลา</th><th>LINE</th></tr></thead>
          <tbody>{d.people.map(p => (
            <tr key={p.id}>
              <td><b>{p.username}</b><div className="mut" style={{ fontSize: 11 }}>{p.email}</div></td>
              <td>{p.stats.active}</td><td>{p.stats.todo}</td>
              <td style={{ color: p.stats.overdue ? 'var(--blue)' : undefined, fontWeight: p.stats.overdue ? 700 : 400 }}>{p.stats.overdue}</td>
              <td>{p.stats.dueSoon}</td><td>{p.stats.done30}</td><td>{p.stats.onTime === null ? '–' : p.stats.onTime + '%'}</td>
              <td>{p.line ? <Link href={`/admin/line/${p.line.line_user_id}`} style={{ color: 'var(--blue)' }}>เปิด</Link> : <span className="mut">ยังไม่เชื่อม</span>}</td>
            </tr>))}</tbody>
        </table></div></section>}

        {tab === 'done' && <section className="card" style={{ gap: 6 }}>
          {!d.doneRecent.length ? <div className="empty">ยังไม่มีโปรเจกต์เสร็จใน 14 วัน</div> : d.doneRecent.map(p =>
            <a key={p.id} href={p.url} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>✓ <b>{p.name}</b> <span className="mut" style={{ fontSize: 12 }}>· {p.total} คลิป · {new Date(p.date_done).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span></a>)}
        </section>}
      </>}
    </AdminShell>
  );
}
