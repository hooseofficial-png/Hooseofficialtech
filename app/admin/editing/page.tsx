'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import AdminShell, { Grid, Tile } from '@/components/admin/AdminShell';
import { toast } from '@/lib/ui';

type Call = { id: string; status: string; reason: string; sent_to: number; created_at: string };
type Pj = { id: string; name: string; url: string; status: string; due: number | null; description: string; refs: string[]; total: number; open: number; openNames: string[];
  assignees: { id: number; username: string }[]; call: Call | null; state: 'ok' | 'due_soon' | 'overdue' };
type P = { id: number; username: string; email: string; line: { line_user_id: string } | null;
  stats: { active: number; todo: number; review: number; overdue: number; dueSoon: number; done30: number; onTime: number | null } };
type D = { configured: boolean; webhook: boolean; hiddenOld: number; unassigned: Pj[]; inProgress: Pj[]; doneRecent: { id: string; name: string; url: string; total: number; date_done: number }[];
  people: P[]; editorsOnLine: number; unlinkedEditors: { line_user_id: string; name: string }[]; toAddInClickUp: { project: string; url: string; name: string; at: string }[] };

// Status colours (asked for by the owner): red = overdue, amber = due within 3 days, blue = nobody yet, green = in progress.
const ZONE = {
  overdue:  { label: 'เลยกำหนด',          fg: '#C62828', bg: '#FDECEC', bar: '#E53935' },
  due_soon: { label: 'ใกล้ครบกำหนด',      fg: '#A15C00', bg: '#FFF4E0', bar: '#F59E0B' },
  open:     { label: 'ยังไม่มีคนรับ',      fg: '#0D00FF', bg: '#EEF0FF', bar: '#0D00FF' },
  ok:       { label: 'กำลังดำเนินการ',     fg: '#1B7F3B', bg: '#E8F6EC', bar: '#22A447' }
} as const;
type Zone = keyof typeof ZONE;
const zoneOf = (p: Pj): Zone => p.state === 'overdue' ? 'overdue' : p.state === 'due_soon' ? 'due_soon' : !p.assignees.length ? 'open' : 'ok';

const dueText = (ms: number | null) => {
  if (!ms) return 'ไม่กำหนดส่ง';
  const days = Math.ceil((ms - Date.now()) / 864e5);
  const d = new Date(ms).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  return days < 0 ? `เลย ${-days} วัน (${d})` : days === 0 ? `ส่งวันนี้ (${d})` : `อีก ${days} วัน (${d})`;
};
const initials = (n: string) => n.replace(/\(.*?\)/g, '').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

/** Editing report: every current ClickUp project by status zone, Open Call on LINE in one tap. Never writes to ClickUp. */
export default function Editing() {
  const [d, setD] = useState<D | null>(null); const [denied, setDenied] = useState(false); const [err, setErr] = useState('');
  const [tab, setTab] = useState<'work' | 'team' | 'done'>('work'); const [busy, setBusy] = useState('');
  const load = () => fetch('/api/admin/editing').then(async r => {
    if (r.status === 403 || r.status === 401) { setDenied(true); return; }
    const j = await r.json().catch(() => ({})); if (!r.ok) { setErr(j.error || 'โหลดไม่สำเร็จ'); return; } setErr(''); setD(j);
  }).catch(e => setErr(String(e)));
  useEffect(() => { load(); }, []);

  async function openCall(p: Pj) {
    setBusy(p.id);
    const r = await fetch('/api/admin/editing/call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_id: p.id }) });
    const j = await r.json().catch(() => ({})); setBusy('');
    toast(r.ok ? `Open Call ${p.open} คลิป · ส่งถึงนักตัดต่อ ${j.sent} คนใน LINE แล้ว` : (j.error || 'ส่งไม่สำเร็จ')); if (r.ok) load();
  }
  async function cancel(c: Call) { await fetch('/api/admin/editing/call?id=' + c.id, { method: 'DELETE' }); toast('ปิด Open Call แล้ว'); load(); }
  async function connect() {
    setBusy('hook'); const r = await fetch('/api/admin/editing/webhook', { method: 'POST' }); const j = await r.json().catch(() => ({})); setBusy('');
    toast(r.ok ? 'เชื่อม ClickUp แล้ว' : (j.error || 'ไม่สำเร็จ')); if (r.ok) load();
  }

  const all = d ? [...d.unassigned, ...d.inProgress] : [];
  const zones: Zone[] = ['overdue', 'due_soon', 'open', 'ok'];
  const count = (z: Zone) => all.filter(p => zoneOf(p) === z).length;

  return (
    <AdminShell title="ตัดต่อ · ClickUp" denied={denied} sub={d?.configured ? <span className="mut" style={{ fontSize: 13 }}>นักตัดต่อใน LINE OA {d.editorsOnLine} คน</span> : null}>
      {err ? <div className="notice"><span>{err}</span></div>
      : !d ? <div className="empty">กำลังดึงโปรเจกต์จาก ClickUp…</div>
      : !d.configured ? <div className="card"><b>ยังไม่ได้เชื่อม ClickUp</b><span className="mut">ใส่ ClickUp API Token ใน Vercel แล้ว Redeploy</span></div>
      : <>
        {!d.webhook && (
          <section className="card" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 16px' }}>
            <span className="mut" style={{ flex: 1, fontSize: 13 }}>เชื่อมครั้งเดียว เพื่อให้แจ้งเตือนใกล้ครบกำหนดทาง LINE ทำงานเอง (อ่านจาก ClickUp อย่างเดียว)</span>
            <button className="btn sm" disabled={!!busy} onClick={connect}>เชื่อม ClickUp</button>
          </section>)}

        <Grid>
          {zones.map(z => (
            <div key={z} className="card" style={{ padding: 14, gap: 4, borderColor: count(z) ? ZONE[z].bar : undefined, background: count(z) ? ZONE[z].bg : undefined }}>
              <span style={{ fontSize: 12, color: ZONE[z].fg, fontWeight: 600 }}>{ZONE[z].label}</span>
              <b style={{ fontSize: 26, color: count(z) ? ZONE[z].fg : 'var(--ink)' }}>{count(z)}</b>
            </div>))}
        </Grid>

        {d.toAddInClickUp.length > 0 && (
          <section className="card" style={{ gap: 6, padding: '12px 16px' }}>
            <b style={{ fontSize: 14 }}>รับงานจาก LINE แล้ว · ใส่ชื่อใน ClickUp</b>
            {d.toAddInClickUp.map((x, i) => <span key={i} style={{ fontSize: 13 }}>✋ <b>{x.name}</b> รับ <a href={x.url} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', fontWeight: 600 }}>{x.project}</a> <span className="mut">· {new Date(x.at).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></span>)}
          </section>)}

        <div className="seg" style={{ alignSelf: 'flex-start' }}>
          {([['work', `งานปัจจุบัน (${all.length})`], ['team', 'ทีมตัดต่อ'], ['done', 'เสร็จล่าสุด']] as const).map(([k, l]) =>
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
        </div>

        {tab === 'work' && (all.length === 0 ? <div className="empty">ไม่มีงานค้าง 🎉</div> : zones.filter(z => count(z)).map(z => (
          <section key={z} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 99, background: ZONE[z].bar }} />
              <b style={{ color: ZONE[z].fg }}>{ZONE[z].label}</b><span className="mut" style={{ fontSize: 13 }}>{count(z)} โปรเจกต์</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
              {all.filter(p => zoneOf(p) === z).map(p => <ProjectCard key={p.id} p={p} zone={z} busy={busy === p.id} onCall={() => openCall(p)} onCancel={cancel} />)}
            </div>
          </section>)))}

        {tab === 'team' && <section className="card" style={{ padding: 0 }}><div className="tblw"><table className="tbl">
          <thead><tr><th>นักตัดต่อ</th><th>คลิปที่ถือ</th><th>ยังไม่เริ่ม</th><th>เลยกำหนด</th><th>ใกล้ส่ง</th><th>เสร็จ 30 วัน</th><th>ตรงเวลา</th><th>LINE</th></tr></thead>
          <tbody>{d.people.map(p => (
            <tr key={p.id}>
              <td><b>{p.username}</b><div className="mut" style={{ fontSize: 11 }}>{p.email}</div></td>
              <td>{p.stats.active}</td><td>{p.stats.todo}</td>
              <td style={{ color: p.stats.overdue ? ZONE.overdue.fg : undefined, fontWeight: p.stats.overdue ? 700 : 400 }}>{p.stats.overdue}</td>
              <td style={{ color: p.stats.dueSoon ? ZONE.due_soon.fg : undefined }}>{p.stats.dueSoon}</td><td>{p.stats.done30}</td><td>{p.stats.onTime === null ? '–' : p.stats.onTime + '%'}</td>
              <td>{p.line ? <Link href={`/admin/line/${p.line.line_user_id}`} style={{ color: 'var(--blue)' }}>เปิด</Link> : <span className="mut">ยังไม่เชื่อม</span>}</td>
            </tr>))}</tbody>
        </table></div></section>}

        {tab === 'done' && <section className="card" style={{ gap: 6 }}>
          {!d.doneRecent.length ? <div className="empty">ยังไม่มีโปรเจกต์เสร็จใน 14 วัน</div> : d.doneRecent.map(p =>
            <a key={p.id} href={p.url} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}><span style={{ color: ZONE.ok.fg }}>✓</span> <b>{p.name}</b> <span className="mut" style={{ fontSize: 12 }}>· {p.total} คลิป · {new Date(p.date_done).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span></a>)}
        </section>}

        {d.hiddenOld > 0 && <span className="mut" style={{ fontSize: 12 }}>แสดงเฉพาะงานปัจจุบัน · ซ่อนงานเก่า {d.hiddenOld} รายการ · หน้านี้อ่านจาก ClickUp อย่างเดียว ไม่แก้งานใน ClickUp</span>}
        {d.unlinkedEditors.length > 0 && <span className="mut" style={{ fontSize: 12 }}>นักตัดต่อใน LINE ที่ยังไม่จับคู่กับ ClickUp: {d.unlinkedEditors.map(x => <Link key={x.line_user_id} href={`/admin/line/${x.line_user_id}`} style={{ color: 'var(--blue)', marginRight: 6 }}>{x.name}</Link>)}</span>}
      </>}
    </AdminShell>
  );
}

function ProjectCard({ p, zone, busy, onCall, onCancel }: { p: Pj; zone: Zone; busy: boolean; onCall: () => void; onCancel: (c: Call) => void }) {
  const z = ZONE[zone];
  const done = p.total - p.open;
  const pct = Math.round(done / p.total * 100);
  const callOpen = p.call?.status === 'open';
  return (
    <article className="card" style={{ gap: 12, padding: 16, borderColor: z.bar, borderTop: `4px solid ${z.bar}`, borderRadius: '0 0 14px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <a href={p.url} target="_blank" rel="noreferrer" style={{ fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 16, color: 'var(--ink)', lineHeight: 1.3, display: 'block' }}>{p.name}</a>
          <span className="mut" style={{ fontSize: 12 }}>{p.status}</span>
        </div>
        <span style={{ background: z.bar, color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 99, whiteSpace: 'nowrap' }}>{z.label}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
          <span className="mut">{p.total > 1 ? `ส่งแล้ว ${done}/${p.total} · เหลือ ${p.open} คลิป` : p.open ? 'ยังไม่ส่ง' : 'ส่งแล้ว'}</span>
          <b style={{ color: z.fg, background: z.bg, padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap' }}>⏰ {dueText(p.due)}</b>
        </div>
        <div style={{ height: 8, background: 'var(--soft)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ width: pct + '%', height: '100%', background: z.bar, borderRadius: 99 }} />
        </div>
        {p.total > 1 && p.open > 0 && <span className="mut ell" style={{ fontSize: 11 }}>เหลือ: {p.openNames.slice(0, 6).map(n => n.replace(/[:：\s]+$/, '')).join(' · ')}{p.openNames.length > 6 ? ' …' : ''}</span>}
      </div>

      {p.description && <p className="mut" style={{ fontSize: 13, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.description}</p>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {p.assignees.length ? <>
            <div style={{ display: 'flex' }}>{p.assignees.slice(0, 3).map((a, i) => (
              <span key={a.id} title={a.username} style={{ width: 28, height: 28, borderRadius: 99, background: 'var(--blue-bg)', color: 'var(--blue)', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center', border: '2px solid var(--paper)', marginLeft: i ? -8 : 0 }}>{initials(a.username)}</span>))}</div>
            <span className="ell" style={{ fontSize: 12, color: 'var(--ink-2)', maxWidth: 150 }}>{p.assignees.map(a => a.username).join(', ')}</span>
          </> : <span className="mut" style={{ fontSize: 12 }}>ยังไม่มีคนรับ</span>}
          {p.refs.slice(0, 2).map((u, i) => <a key={u} href={u} target="_blank" rel="noreferrer" style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)', background: 'var(--blue-bg)', padding: '3px 8px', borderRadius: 99 }}>▶ REF{p.refs.length > 1 ? ' ' + (i + 1) : ''}</a>)}
        </div>
        {p.open > 0 && (callOpen
          ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span className="chip lb">Open Call แล้ว · {p.call!.sent_to} คน</span><button className="btn sm ghost" onClick={() => onCancel(p.call!)}>ปิด</button></span>
          : <button className="btn p sm" disabled={busy} onClick={onCall}>{busy ? 'กำลังส่ง…' : `Open Call ${p.open} คลิป`}</button>)}
      </div>
    </article>
  );
}
