'use client';
import { useEffect, useState } from 'react';
import AdminShell, { Bars, Grid, HBars, Tile } from '@/components/admin/AdminShell';

type W = { label: string; applied: number; follows: number; done: number; created: number };
type S = {
  editing: { configured: boolean; error?: string; done30?: number; open?: number; overdue?: number; perEditor?: { label: string; value: number }[]; callsAssigned30?: number };
  production: { perMonth: { label: string; a: number }[]; openPositions: number; confirmedPositions: number; pendingPositions: number };
  recruiting: { funnel: { status: string; n: number }[] };
  weeks: W[];
};
const FUNNEL_TH: Record<string, string> = { new: 'เพิ่มเพื่อน', applying: 'กำลังสมัคร', applied: 'ส่งผลงาน', approved: 'ผ่าน', active: 'มีบัญชีกองถ่าย', rejected: 'ไม่ผ่าน' };

/** Analytics: 12-week trends for editing throughput and recruiting, production per month, per-editor output. */
export default function Analytics() {
  const [s, setS] = useState<S | null>(null); const [denied, setDenied] = useState(false);
  useEffect(() => { fetch('/api/admin/summary').then(async r => { if (r.status === 403 || r.status === 401) { setDenied(true); return; } setS(await r.json()); }); }, []);
  const legend = (a: string, b?: string) => (
    <span className="row" style={{ gap: 12, fontSize: 12 }}>
      {b && <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: 'var(--blue-bg)', marginRight: 4 }} />{b}</span>}
      <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: 'var(--blue)', marginRight: 4 }} />{a}</span>
    </span>);
  const fill = s ? s.production.confirmedPositions + s.production.pendingPositions + s.production.openPositions : 0;
  return (
    <AdminShell title="วิเคราะห์ข้อมูล" denied={denied}>
      {!s ? <div className="empty">กำลังโหลด…</div> : <>
        <Grid>
          <Tile label="งานตัดเสร็จ 30 วัน" value={s.editing.done30 ?? '–'} />
          <Tile label="งานตัดเปิดอยู่" value={s.editing.open ?? '–'} sub={`เลยกำหนด ${s.editing.overdue ?? '–'}`} />
          <Tile label="รับงานผ่าน LINE 30 วัน" value={s.editing.callsAssigned30 ?? '–'} />
          <Tile label="อัตราเติมทีมโปรดักชัน" value={fill ? Math.round(s.production.confirmedPositions / fill * 100) + '%' : '–'} sub={`${s.production.confirmedPositions} จาก ${fill} ตำแหน่ง`} />
        </Grid>
        {s.editing.configured && !s.editing.error && (
          <section className="card">
            <div className="between"><h2>งานตัดต่อ 12 สัปดาห์</h2>{legend('เสร็จ', 'งานใหม่')}</div>
            <Bars data={s.weeks.map(w => ({ label: w.label, a: w.done, b: w.created }))} />
          </section>)}
        {!!s.editing.perEditor?.length && (
          <section className="card"><h2>งานที่เสร็จ 30 วัน · รายคน</h2><HBars rows={s.editing.perEditor} /></section>)}
        <section className="card">
          <div className="between"><h2>รับสมัคร 12 สัปดาห์</h2>{legend('ส่งผลงาน', 'เพิ่มเพื่อน')}</div>
          <Bars data={s.weeks.map(w => ({ label: w.label, a: w.applied, b: w.follows }))} />
        </section>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
          <section className="card"><h2>Funnel รับสมัคร</h2><HBars rows={s.recruiting.funnel.map(f => ({ label: FUNNEL_TH[f.status] || f.status, value: f.n }))} /></section>
          <section className="card"><h2>โปรเจกต์ต่อเดือน</h2><Bars data={s.production.perMonth} height={120} /></section>
        </div>
      </>}
    </AdminShell>
  );
}
