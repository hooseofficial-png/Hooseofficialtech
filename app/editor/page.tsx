'use client';
import { useEffect, useState } from 'react';
import TopBar from '@/components/TopBar';
import { getMe } from '@/lib/me';

// Editor home: what an approved editor sees when they open the HOOSE app (instead of the production overview).
type Left = { name: string; stage: string; status: string };
type Pj = { id: string; name: string; url: string; due: number | null; total: number; left: Left[] };
type T = { id: string; name: string; parent_name: string; url: string; status: string; date_done: number | null };
type W = { linked: boolean; reason?: string; user?: { full_name: string; display_name: string; picture_url: string };
  stats?: { active: number; todo: number; review: number; overdue: number; dueSoon: number; done30: number; onTime: number | null }; projects?: Pj[]; done?: T[] };

const STAGE: Record<string, string> = { todo: 'ยังไม่เริ่ม', doing: 'กำลังตัด', review: 'รอตรวจ / แก้', done: 'เสร็จแล้ว' };
const LINE_OA = process.env.NEXT_PUBLIC_LINE_OA_URL || ''; // e.g. https://line.me/R/ti/p/@xxxx (button hidden when empty)

function due(ms: number | null) {
  if (!ms) return { text: 'ยังไม่กำหนดส่ง', hot: false };
  const days = Math.ceil((ms - Date.now()) / 864e5);
  const d = new Date(ms).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  return days < 0 ? { text: `เลยกำหนด ${-days} วัน · ${d}`, hot: true } : days === 0 ? { text: `ส่งวันนี้ · ${d}`, hot: true } : { text: `อีก ${days} วัน · ${d}`, hot: days <= 3 };
}

export default function EditorHome() {
  const [w, setW] = useState<W | null>(null); const [err, setErr] = useState(''); const [name, setName] = useState('');
  useEffect(() => {
    getMe().then(m => setName(m?.profile?.full_name || ''));
    fetch('/api/editor/work').then(async r => {
      if (r.status === 401) { window.location.href = '/login'; return; }
      const j = await r.json().catch(() => ({})); if (!r.ok) setErr(j.error || 'โหลดไม่สำเร็จ'); else setW(j);
    });
  }, []);
  const s = w?.stats;
  const tile = (label: string, v: React.ReactNode, hot = false) => (
    <div className="card" style={{ padding: 16, gap: 4 }}>
      <span className="mut" style={{ fontSize: 12 }}>{label}</span>
      <b style={{ fontFamily: 'var(--f-display)', fontSize: 28, lineHeight: 1.1, color: hot ? 'var(--blue)' : 'var(--ink)' }}>{v}</b>
    </div>);

  return (
    <><TopBar label="HOOSE · Editor" /><main className="wrap" style={{ maxWidth: 960 }}>
      <section style={{ background: 'var(--blue)', color: '#fff', borderRadius: 18, padding: '22px 24px', display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, letterSpacing: '.12em', fontWeight: 700, opacity: .85 }}>HOOSE EDITOR</div>
          <div style={{ fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 24, marginTop: 4 }}>สวัสดีค่ะ{name ? ' คุณ' + name : ''} ✂️</div>
          <div style={{ fontSize: 14, opacity: .9, marginTop: 4 }}>{s ? (s.active ? `ตอนนี้มีงานที่ถืออยู่ ${s.active} คลิป${s.overdue ? ` · เลยกำหนด ${s.overdue}` : ''}` : 'ตอนนี้ไม่มีงานค้าง พร้อมรับโปรเจกต์ใหม่') : 'กำลังโหลดงานของคุณ…'}</div>
        </div>
        {LINE_OA && <a href={LINE_OA} target="_blank" rel="noreferrer" className="btn" style={{ background: '#fff', color: 'var(--blue)', borderColor: '#fff', fontWeight: 700 }}>เปิดแชทน้องฮูส</a>}
      </section>

      {err ? <div className="notice"><span>{err}</span></div>
      : !w ? <div className="empty">กำลังโหลด…</div>
      : !w.linked ? (
        <div className="card" style={{ gap: 8 }}>
          <b>{w.reason === 'no_account' ? 'ยังไม่เห็นงานใน ClickUp ของคุณ' : 'ยังเชื่อมงานไม่ได้'}</b>
          <span className="mut">{w.reason === 'no_account' ? 'ทีมงานกำลังผูกบัญชี ClickUp ให้ ถ้ารอนาน ทักน้องฮูสใน LINE ได้เลยค่ะ' : 'ทักน้องฮูสใน LINE เพื่อให้ทีมช่วยตรวจสอบค่ะ'}</span>
        </div>)
      : <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          {tile('คลิปที่ถืออยู่', s!.active, s!.active > 0)}
          {tile('เลยกำหนด', s!.overdue, s!.overdue > 0)}
          {tile('ใกล้ส่ง (3 วัน)', s!.dueSoon, s!.dueSoon > 0)}
          {tile('เสร็จใน 30 วัน', s!.done30)}
          {tile('ส่งตรงเวลา', s!.onTime === null ? '–' : s!.onTime + '%')}
        </div>

        <h2 style={{ margin: '6px 0 0' }}>โปรเจกต์ปัจจุบัน</h2>
        {!w.projects?.length ? <div className="empty">ยังไม่มีโปรเจกต์ค้าง 🙌 มีโปรเจกต์ใหม่ น้องฮูสจะส่งให้ใน LINE ก่อนเลยค่ะ</div> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {w.projects.map(p => {
              const d = due(p.due); const sent = p.total - p.left.length; const pct = Math.round(sent / p.total * 100);
              return (
                <article key={p.id} className="card" style={{ gap: 12, padding: 18, borderColor: d.hot ? 'var(--blue)' : undefined }}>
                  <div className="between" style={{ gap: 10, alignItems: 'flex-start' }}>
                    <b style={{ fontFamily: 'var(--f-display)', fontSize: 16, lineHeight: 1.3 }}>{p.name}</b>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 99, whiteSpace: 'nowrap', background: d.hot ? 'var(--blue)' : 'var(--blue-bg)', color: d.hot ? '#fff' : 'var(--blue)' }}>⏰ {d.text}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span className="mut" style={{ fontSize: 12 }}>{p.total > 1 ? `ส่งแล้ว ${sent}/${p.total} คลิป` : STAGE[p.left[0]?.stage || 'todo']}</span>
                    <div style={{ height: 8, background: 'var(--soft)', borderRadius: 99, overflow: 'hidden' }}><div style={{ width: pct + '%', height: '100%', background: 'var(--blue)', borderRadius: 99 }} /></div>
                  </div>
                  {p.left.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {p.left.slice(0, 10).map((c, i) => <span key={i} title={c.status} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 99, background: c.stage === 'todo' ? 'var(--soft)' : 'var(--blue-bg)', color: c.stage === 'todo' ? 'var(--ink-2)' : 'var(--blue)' }}>{c.name} · {STAGE[c.stage]}</span>)}
                      {p.left.length > 10 && <span className="mut" style={{ fontSize: 11 }}>+{p.left.length - 10}</span>}
                    </div>)}
                  <a href={p.url} target="_blank" rel="noreferrer" className="btn p sm" style={{ alignSelf: 'flex-start' }}>เปิดใน ClickUp</a>
                </article>);
            })}
          </div>)}

        {!!w.done?.length && (
          <section className="card" style={{ gap: 8 }}>
            <h2>เสร็จล่าสุด</h2>
            {w.done.map(t => <a key={t.id} href={t.url} target="_blank" rel="noreferrer" style={{ fontSize: 14, color: 'inherit' }}>✓ {t.name}{t.parent_name ? <span className="mut"> · {t.parent_name}</span> : null}</a>)}
          </section>)}
      </>}
      <span className="mut" style={{ fontSize: 12 }}>บัญชีนักตัดต่อไม่สามารถสร้าง Workspace หรือโปรเจกต์ได้ ส่วนนี้สำหรับทีมโปรดักชัน PM ผู้กำกับ และโปรดิวเซอร์</span>
    </main></>
  );
}
