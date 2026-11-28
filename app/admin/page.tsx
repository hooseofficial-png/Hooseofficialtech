'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import AdminShell, { Grid, Tile } from '@/components/admin/AdminShell';

type Summary = {
  editing: { configured: boolean; error?: string; open?: number; unassigned?: number; overdue?: number; dueSoon?: number; review?: number; done30?: number; callsOpen?: number };
  production: { projects: number; live: number; openPositions: number; pendingPositions: number; confirmedPositions: number; openCallsQueued: number;
    shoots: { date: string; time: string | null; title: string; project: string }[] };
  recruiting: { waiting: number; attention: number; team: { editor: number; crew: number }; followers: number };
};

/** Super dashboard home: what needs attention across Editing, Production and Recruiting. */
export default function AdminHome() {
  const [s, setS] = useState<Summary | null>(null); const [denied, setDenied] = useState(false);
  useEffect(() => {
    fetch('/api/admin/summary').then(async r => { if (r.status === 403 || r.status === 401) { setDenied(true); return; } setS(await r.json()); });
  }, []);
  const e = s?.editing;
  return (
    <AdminShell title="ภาพรวม HOOSE" denied={denied}>
      {!s ? <div className="empty">กำลังโหลด…</div> : <>
        <h2 style={{ margin: 0 }}>ต้องทำตอนนี้</h2>
        <Grid min={170}>
          <Tile label="โปรเจกต์ตัดยังไม่มีคนรับ" value={e?.configured ? e.unassigned ?? '–' : '–'} sub={e?.configured ? 'โปรเจกต์ใน ClickUp · กดเพื่อ Open Call' : 'ยังไม่ได้เชื่อม ClickUp'} hot={!!e?.unassigned} href="/admin/editing" />
          <Tile label="โปรเจกต์ตัดเลยกำหนด" value={e?.overdue ?? '–'} sub={`ใกล้ส่งใน 3 วัน ${e?.dueSoon ?? '–'}`} hot={!!e?.overdue} href="/admin/editing" />
          <Tile label="Open Call รอส่ง" value={s.production.openCallsQueued} sub={`ตำแหน่งที่ยังว่าง ${s.production.openPositions}`} hot={s.production.openCallsQueued > 0} href="/admin/production" />
          <Tile label="ผลงานรอตรวจ" value={s.recruiting.waiting} sub="ผู้สมัครใหม่จาก LINE" hot={s.recruiting.waiting > 0} href="/admin/line" />
          <Tile label="รอทีมตอบในแชท" value={s.recruiting.attention} sub="คำถามที่น้องฮูสส่งต่อ · กดดูรายชื่อ" hot={s.recruiting.attention > 0} href="/admin/line?f=attention" />
        </Grid>
        {e?.error && <div className="notice"><span>เชื่อม ClickUp ไม่สำเร็จ: {e.error}</span></div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
          <section className="card">
            <div className="between"><h2>✂️ ตัดต่อ</h2><Link href="/admin/editing" className="mut" style={{ fontSize: 13 }}>ดูทั้งหมด ›</Link></div>
            {e?.configured && !e.error ? <Grid min={110}>
              <Tile label="คลิปที่ยังเปิดอยู่" value={e.open ?? 0} /><Tile label="รอตรวจ / แก้" value={e.review ?? 0} /><Tile label="เสร็จ 30 วัน" value={e.done30 ?? 0} />
            </Grid> : <span className="mut">ใส่ CLICKUP_API_TOKEN ใน Vercel เพื่อดึงงานจาก ClickUp</span>}
          </section>
          <section className="card">
            <div className="between"><h2>🎬 โปรดักชัน</h2><Link href="/admin/production" className="mut" style={{ fontSize: 13 }}>ดูทั้งหมด ›</Link></div>
            <Grid min={110}>
              <Tile label="โปรเจกต์ที่ยังไม่จบ" value={s.production.live} sub={`ทั้งหมด ${s.production.projects}`} />
              <Tile label="ทีมยืนยันแล้ว" value={s.production.confirmedPositions} sub={`รอยืนยัน ${s.production.pendingPositions}`} />
            </Grid>
            <span className="mut" style={{ fontSize: 12 }}>วันถ่าย 14 วันข้างหน้า</span>
            {s.production.shoots.length ? s.production.shoots.map((x, i) => <span key={i} style={{ fontSize: 13 }}>🎥 {new Date(x.date + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}{x.time ? ' ' + x.time.slice(0, 5) : ''} · {x.project} · {x.title}</span>)
              : <span className="mut" style={{ fontSize: 13 }}>ยังไม่มีคิวถ่าย</span>}
          </section>
          <section className="card">
            <div className="between"><h2>👋 รับสมัคร</h2><Link href="/admin/line" className="mut" style={{ fontSize: 13 }}>ดูทั้งหมด ›</Link></div>
            <Grid min={110}>
              <Tile label="นักตัดต่อในทีม" value={s.recruiting.team.editor} /><Tile label="ทีมโปรดักชัน" value={s.recruiting.team.crew} /><Tile label="เพื่อนใน LINE OA" value={s.recruiting.followers} />
            </Grid>
          </section>
        </div>
      </>}
    </AdminShell>
  );
}
