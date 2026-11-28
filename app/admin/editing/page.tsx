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
  people: P[]; editorsOnLine: number; unlinkedEditors: { line_user_id: string; name: string }[]; toAddInClickUp: { project: string; url: string; name: string; at: string }[] };

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
  const [compose, setCompose] = useState<Pj | null>(null); const [reassign, setReassign] = useState(false); const [detail, setDetail] = useState(''); const [rate, setRate] = useState(''); const [busy, setBusy] = useState('');
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
  const announce = async () => { if (compose && await post('/api/admin/editing/call', { project_id: compose.id, detail, rate, reassign }, j => `ประกาศใน LINE แล้ว · ส่งถึงนักตัดต่อ ${j.sent} คน`, 'call')) setCompose(null); };
  const connect = () => post('/api/admin/editing/webhook', {}, () => 'เชื่อม ClickUp แล้ว', 'hook');
  const openCompose = (p: Pj, again: boolean) => { setCompose(p); setReassign(again); setDetail(p.description); setRate(''); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  async function cancel(c: Call) {
    if (!confirm('ยกเลิกประกาศนี้?')) return;
    await fetch('/api/admin/editing/call?id=' + c.id, { method: 'DELETE' }); load();
  }

  const card = (p: Pj, action: React.ReactNode) => <ProjectCard key={p.id} p={p} action={action} />;

  return (
    <AdminShell title="ตัดต่อ · ClickUp" denied={denied} sub={d?.configured ? <span className="mut" style={{ fontSize: 13 }}>นักตัดต่อใน LINE OA {d.editorsOnLine} คน</span> : null}>
      {err ? <div className="notice"><span>{err}</span></div>
      : !d ? <div className="empty">กำลังดึงโปรเจกต์จาก ClickUp…</div>
      : !d.configured ? <div className="card"><b>ยังไม่ได้เชื่อม ClickUp</b><span className="mut">ใส่ ClickUp API Token ใน Vercel แล้ว Redeploy</span></div>
      : <>
        <section className="card" style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '14px 18px' }}>
          <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 99, flex: '0 0 10px', background: d.webhook ? 'var(--blue)' : 'var(--mut-2)', boxShadow: d.webhook ? '0 0 0 4px var(--blue-bg)' : 'none' }} />
          <div style={{ flex: 1, minWidth: 220 }}>
            <b style={{ fontSize: 14 }}>{d.webhook ? 'อ่านข้อมูลจาก ClickUp อยู่' : 'ยังไม่ได้รับแจ้งจาก ClickUp'}</b>
            <div className="mut" style={{ fontSize: 12 }}>หน้านี้เป็นรายงานสถานะ อ่านจาก ClickUp อย่างเดียว ไม่แก้งานใน ClickUp · ใกล้ครบกำหนดจะแจ้งนักตัดต่อใน LINE ให้เอง</div>
          </div>
          {!d.webhook && <button className="btn sm" disabled={!!busy} onClick={connect}>เชื่อม ClickUp (ครั้งเดียว)</button>}
        </section>
        <Grid>
          <Tile label="โปรเจกต์ยังไม่มีคนรับ" value={d.unassigned.length} hot={d.unassigned.length > 0} onClick={() => setTab('new')} />
          <Tile label="กำลังทำ" value={d.inProgress.length} onClick={() => setTab('doing')} />
          <Tile label="ใกล้ครบ / เลยกำหนด" value={d.inProgress.filter(p => p.state !== 'ok').length} hot={d.inProgress.some(p => p.state !== 'ok')} onClick={() => setTab('doing')} />
          <Tile label="รับงานจาก LINE แล้ว" value={d.toAddInClickUp.length} sub="รอทีมใส่ชื่อใน ClickUp" hot={d.toAddInClickUp.length > 0} />
        </Grid>
        {d.hiddenOld > 0 && <span className="mut" style={{ fontSize: 12 }}>แสดงเฉพาะงานปัจจุบัน · ซ่อนงานเก่า {d.hiddenOld} รายการ (ข้อมูลใน ClickUp ไม่ถูกแตะ)</span>}
        {d.toAddInClickUp.length > 0 && (
          <section className="card" style={{ gap: 6, padding: '12px 16px' }}>
            <b style={{ fontSize: 14 }}>รับงานจาก LINE แล้ว · ใส่ชื่อใน ClickUp</b>
            {d.toAddInClickUp.map((x, i) => <span key={i} style={{ fontSize: 13 }}>✋ <b>{x.name}</b> รับ <a href={x.url} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', fontWeight: 600 }}>{x.project}</a> <span className="mut">· {new Date(x.at).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></span>)}
          </section>)}
        {d.unlinkedEditors.length > 0 && <span className="mut" style={{ fontSize: 12 }}>นักตัดต่อใน LINE ที่ยังไม่จับคู่กับ ClickUp (จะไม่ได้รับแจ้งเตือน Deadline): {d.unlinkedEditors.map(x => <Link key={x.line_user_id} href={`/admin/line/${x.line_user_id}`} style={{ color: 'var(--blue)', marginRight: 6 }}>{x.name}</Link>)}</span>}
        <div className="seg" style={{ alignSelf: 'flex-start' }}>
          {([['new', `โปรเจกต์ใหม่ (${d.unassigned.length})`], ['doing', `กำลังทำ (${d.inProgress.length})`], ['team', 'ทีมตัดต่อ'], ['done', 'เสร็จล่าสุด']] as const).map(([k, l]) =>
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
        </div>

        {tab === 'new' && <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {!d.unassigned.length ? <div className="empty" style={{ gridColumn: '1 / -1' }}>ทุกโปรเจกต์มีคนรับแล้ว 🎉</div> : d.unassigned.map(p => card(p,
            p.call?.status === 'open'
              ? <span className="row" style={{ gap: 6 }}><span className="chip lb">{p.call.reason === 'reassign' ? 'หาคนแทน' : 'ประกาศแล้ว'} · ส่ง {p.call.sent_to} คน</span><button className="btn sm ghost" onClick={() => cancel(p.call!)}>ยกเลิก</button></span>
              : <button className="btn p sm" onClick={() => openCompose(p, false)}>ประกาศใน LINE</button>))}
        </section>}

        {compose && (
          <section className="card" style={{ borderColor: 'var(--blue)' }}>
            <h2>{reassign ? 'ประกาศหาคนแทนใน LINE' : 'ประกาศโปรเจกต์ใน LINE'} · {compose.name}</h2>
            <span className="mut" style={{ fontSize: 13 }}>{compose.total} คลิป · Deadline {dueText(compose.due)} · ส่งถึงนักตัดต่อใน LINE OA{reassign ? ' (ยกเว้นคนที่รับอยู่)' : ''} · คนแรกที่กดรับจะขึ้นในหน้านี้ให้ทีมใส่ชื่อใน ClickUp · ไม่แก้อะไรใน ClickUp</span>
            <label className="f">รายละเอียดงาน (ดึงจาก description ใน ClickUp แก้ได้)<textarea className="in-t" style={{ height: 110, padding: 10 }} value={detail} onChange={e => setDetail(e.target.value)} /></label>
            {compose.refs.length > 0 && <span style={{ fontSize: 13 }}>REF ที่จะแนบ: {compose.refs.slice(0, 2).map(u => <a key={u} href={u} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', marginRight: 8 }}>{u.replace(/^https?:\/\//, '').slice(0, 40)}</a>)}</span>}
            <label className="f">ค่าตัว (ไม่บังคับ)<input className="in-t" value={rate} onChange={e => setRate(e.target.value)} placeholder="เช่น 800 บาท / คลิป" /></label>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn p sm" disabled={!!busy} onClick={announce}>{busy === 'call' ? 'กำลังส่ง…' : 'ยืนยัน ประกาศทาง LINE'}</button>
              <button className="btn sm ghost" onClick={() => setCompose(null)}>ยกเลิก</button>
            </div>
          </section>)}

        {tab === 'doing' && <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {!d.inProgress.length ? <div className="empty" style={{ gridColumn: '1 / -1' }}>ไม่มีโปรเจกต์ค้าง</div> : d.inProgress.map(p => card(p,
            p.state !== 'overdue' ? null
            : p.call?.status === 'open' ? <span className="chip lb">ประกาศหาคนแทนแล้ว</span>
            : <button className="btn sm" onClick={() => openCompose(p, true)}>หาคนแทนใน LINE</button>))}
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

const initials = (n: string) => n.replace(/\(.*?\)/g, '').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

/** One ClickUp project: clip progress, deadline pill, people, REF links, and the action for it. */
function ProjectCard({ p, action }: { p: Pj; action: React.ReactNode }) {
  const done = p.total - p.open;
  const pct = Math.round(done / p.total * 100);
  const pill = p.state === 'overdue'
    ? { bg: 'var(--blue)', fg: '#fff', label: 'เลยกำหนด' }
    : p.state === 'due_soon' ? { bg: 'var(--blue-bg)', fg: 'var(--blue)', label: 'ใกล้ครบกำหนด' } : null;
  return (
    <article className="card" style={{ gap: 12, padding: 16, borderColor: p.state === 'overdue' ? 'var(--blue)' : undefined }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <a href={p.url} target="_blank" rel="noreferrer" style={{ fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 16, color: 'var(--ink)', lineHeight: 1.3, display: 'block' }}>{p.name}</a>
          <span className="mut" style={{ fontSize: 12 }}>{p.status}</span>
        </div>
        {pill && <span style={{ background: pill.bg, color: pill.fg, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 99, whiteSpace: 'nowrap' }}>{pill.label}</span>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span className="mut">{p.total > 1 ? `ส่งแล้ว ${done}/${p.total} คลิป` : p.open ? 'ยังไม่ส่ง' : 'ส่งแล้ว'}</span>
          <b style={{ color: p.state === 'ok' ? 'var(--ink-2)' : 'var(--blue)' }}>⏰ {dueText(p.due)}</b>
        </div>
        <div style={{ height: 8, background: 'var(--soft)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ width: pct + '%', height: '100%', background: 'var(--blue)', borderRadius: 99, transition: 'width .4s' }} />
        </div>
        {p.total > 1 && p.open > 0 && <span className="mut ell" style={{ fontSize: 11 }}>ค้าง: {p.openNames.slice(0, 6).join(' · ')}{p.openNames.length > 6 ? ' …' : ''}</span>}
      </div>

      {p.description && <p className="mut" style={{ fontSize: 13, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.description}</p>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {p.assignees.length ? <>
            <div style={{ display: 'flex' }}>{p.assignees.slice(0, 3).map((a, i) => (
              <span key={a.id} title={a.username} style={{ width: 28, height: 28, borderRadius: 99, background: 'var(--blue-bg)', color: 'var(--blue)', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center', border: '2px solid var(--paper)', marginLeft: i ? -8 : 0 }}>{initials(a.username)}</span>))}</div>
            <span className="ell" style={{ fontSize: 12, color: 'var(--ink-2)' }}>{p.assignees.map(a => a.username).join(', ')}</span>
          </> : <span className="mut" style={{ fontSize: 12 }}>ยังไม่มีคนรับ</span>}
          {p.refs.slice(0, 2).map((u, i) => <a key={u} href={u} target="_blank" rel="noreferrer" style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)', background: 'var(--blue-bg)', padding: '3px 8px', borderRadius: 99 }}>▶ REF{p.refs.length > 1 ? ' ' + (i + 1) : ''}</a>)}
        </div>
        {action}
      </div>
    </article>
  );
}
