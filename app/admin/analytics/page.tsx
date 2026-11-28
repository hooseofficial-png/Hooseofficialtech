'use client';
import { useEffect, useState } from 'react';
import AdminShell, { Bars } from '@/components/admin/AdminShell';

type TeamRow = { month: string; applied: number; approved: number; rejected: number; size: number; growth: number | null };
type ProdRow = { month: string; created: number; active: number; wrapped: number };
type EditRow = { month: string; created: number; active: number; done: number; clipsDone: number };
type A = { months: string[]; editors: TeamRow[]; crew: TeamRow[]; production: ProdRow[]; editing: EditRow[] | null; editingError: string };

const pct = (g: number | null) => g === null ? '–' : (g > 0 ? '+' : '') + g + '%';

function Legend({ a, b }: { a: string; b?: string }) {
  const dot = (c: string) => <i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: c, marginRight: 4 }} />;
  return <span className="row" style={{ gap: 12, fontSize: 12 }}>{b && <span>{dot('var(--blue-bg)')}{b}</span>}<span>{dot('var(--blue)')}{a}</span></span>;
}
function Kpi({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return <div style={{ background: 'var(--soft)', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
    <span className="mut" style={{ fontSize: 12 }}>{label}</span><b style={{ fontFamily: 'var(--f-display)', fontSize: 24 }}>{value}</b>{sub && <span className="mut" style={{ fontSize: 11 }}>{sub}</span>}
  </div>;
}
function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return <div className="tblw"><table className="tbl" style={{ fontSize: 13 }}>
    <thead><tr>{head.map(h => <th key={h}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={{ fontWeight: j === 0 ? 600 : 400 }}>{c}</td>)}</tr>)}</tbody>
  </table></div>;
}
function Section({ icon, title, sub, children }: { icon: string; title: string; sub: string; children: React.ReactNode }) {
  return <section style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--line)' }}>
    <div><h2 style={{ margin: 0 }}>{icon} {title}</h2><span className="mut" style={{ fontSize: 13 }}>{sub}</span></div>{children}
  </section>;
}

function TeamPanel({ title, rows }: { title: string; rows: TeamRow[] }) {
  const now = rows[rows.length - 1];
  return <div className="card" style={{ gap: 14 }}>
    <h3 style={{ margin: 0 }}>{title}</h3>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
      <Kpi label="ขนาดทีมตอนนี้" value={now.size} /><Kpi label="โตเดือนนี้" value={pct(now.growth)} sub="เทียบเดือนก่อน" /><Kpi label="ผู้สมัครเดือนนี้" value={now.applied} />
    </div>
    <div className="between"><span className="mut" style={{ fontSize: 12 }}>ขนาดทีม · ผู้สมัครต่อเดือน</span><Legend a="ขนาดทีม" b="ผู้สมัคร" /></div>
    <Bars data={rows.map(r => ({ label: r.month, a: r.size, b: r.applied }))} height={120} />
    <Table head={['เดือน', 'ผู้สมัคร', 'ผ่าน', 'ไม่ผ่าน', 'ขนาดทีม', 'โต']} rows={rows.map(r => [r.month, r.applied, r.approved, r.rejected, r.size, pct(r.growth)])} />
  </div>;
}

/** Monthly analytics: recruiting by team, editing projects (ClickUp) and production projects (app), kept in separate blocks. */
export default function Analytics() {
  const [a, setA] = useState<A | null>(null); const [denied, setDenied] = useState(false);
  useEffect(() => { fetch('/api/admin/analytics').then(async r => { if (r.status === 403 || r.status === 401) { setDenied(true); return; } setA(await r.json()); }); }, []);
  const ed = a?.editing; const pr = a?.production;
  const last = <T,>(x: T[] | null | undefined) => x?.[x.length - 1];
  return (
    <AdminShell title="วิเคราะห์ข้อมูล" denied={denied} sub={<span className="mut" style={{ fontSize: 13 }}>รายเดือน · 6 เดือนล่าสุด</span>}>
      {!a ? <div className="empty">กำลังรวบรวมข้อมูล…</div> : <>
        <Section icon="👋" title="รับสมัคร" sub="แยกทีมนักตัดต่อและทีมโปรดักชัน · ผู้สมัคร = ส่งผลงานในเดือนนั้น · ผ่าน = แอดมินยืนยันในเดือนนั้น">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16 }}>
            <TeamPanel title="✂️ ทีมนักตัดต่อ" rows={a.editors} />
            <TeamPanel title="🎥 ทีมโปรดักชัน" rows={a.crew} />
          </div>
        </Section>

        <Section icon="✂️" title="โปรเจกต์ตัดต่อ (ClickUp)" sub="โปรเจกต์ = งานแม่ใน ClickUp · กำลังดำเนินงาน = ยังไม่เสร็จ ณ สิ้นเดือน">
          {!ed ? <div className="notice"><span>{a.editingError ? 'ดึงข้อมูล ClickUp ไม่สำเร็จ' : 'ยังไม่ได้เชื่อม ClickUp'}</span></div> : <div className="card" style={{ gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
              <Kpi label="สร้างใหม่เดือนนี้" value={last(ed)!.created} /><Kpi label="กำลังดำเนินงาน" value={last(ed)!.active} />
              <Kpi label="เสร็จเดือนนี้" value={last(ed)!.done} sub="โปรเจกต์" /><Kpi label="คลิปที่เสร็จเดือนนี้" value={last(ed)!.clipsDone} />
            </div>
            <div className="between"><span className="mut" style={{ fontSize: 12 }}>สร้างใหม่ · เสร็จ ต่อเดือน</span><Legend a="เสร็จ" b="สร้างใหม่" /></div>
            <Bars data={ed.map(r => ({ label: r.month, a: r.done, b: r.created }))} height={120} />
            <Table head={['เดือน', 'สร้างใหม่', 'กำลังดำเนินงาน', 'เสร็จ (โปรเจกต์)', 'คลิปที่เสร็จ']} rows={ed.map(r => [r.month, r.created, r.active, r.done, r.clipsDone])} />
          </div>}
        </Section>

        <Section icon="🎬" title="โปรเจกต์โปรดักชัน (แอป HOOSE)" sub="กำลังดำเนินงาน = มีช่วงงานคาบเกี่ยวเดือนนั้น · ปิดกล้อง = วันจบงานอยู่ในเดือนนั้น">
          <div className="card" style={{ gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
              <Kpi label="สร้างใหม่เดือนนี้" value={last(pr)!.created} /><Kpi label="กำลังดำเนินงาน" value={last(pr)!.active} /><Kpi label="ปิดกล้องเดือนนี้" value={last(pr)!.wrapped} />
            </div>
            <div className="between"><span className="mut" style={{ fontSize: 12 }}>สร้างใหม่ · กำลังดำเนินงาน ต่อเดือน</span><Legend a="กำลังดำเนินงาน" b="สร้างใหม่" /></div>
            <Bars data={pr!.map(r => ({ label: r.month, a: r.active, b: r.created }))} height={120} />
            <Table head={['เดือน', 'สร้างใหม่', 'กำลังดำเนินงาน', 'ปิดกล้อง']} rows={pr!.map(r => [r.month, r.created, r.active, r.wrapped])} />
          </div>
        </Section>
      </>}
    </AdminShell>
  );
}
